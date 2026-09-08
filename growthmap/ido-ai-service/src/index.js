import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { config, hasApiKey } from './config.js';
import { callClaude, streamClaude } from './anthropic.js';
import { sanitizeObject, sanitizeText } from './sanitize.js';
import { TASKS } from './prompts.js';
import { verifyFirebaseIdToken } from './firebase-auth.js';
import { parseAllowlist, allowlistEnabled, evaluateCaller, mergeAllowlists, getRemoteAllowlist } from './allowlist.js';
import { parseServiceAccount, createAdminTokenProvider } from './service-account.js';
import {
  createIdentityToolkitClient, validateEmail, validatePassword, validateDisplayName, validateUid,
  ValidationError, AdminUpstreamError,
} from './admin-accounts.js';
import { checkPlatformAdmin } from './admin-guard.js';
import { createFirestoreAdminClient } from './admin-firestore.js';
import { createKeyProbe } from './anthropic-probe.js';

const app = new Hono();

// email 白名單（成本洞：任何有效 Firebase 登入都能燒 Anthropic 額度——
// 設 ALLOWED_EMAILS／ALLOWED_EMAIL_DOMAINS 後僅名單內帳號可用 AI）
const allowlist = parseAllowlist(process.env);

// 管理端點的特權層（做法 A）：服務帳號未設定＝/api/admin/* 回 503，其餘功能照常
const serviceAccount = parseServiceAccount(config.serviceAccountJson);
const adminTokenProvider = serviceAccount ? createAdminTokenProvider(serviceAccount) : null;
const adminProjectId = config.firebaseProjectId || serviceAccount?.projectId || '';
const adminClient = serviceAccount
  ? createIdentityToolkitClient({ projectId: adminProjectId, getAccessToken: adminTokenProvider.getAccessToken })
  : null;
// 刪除帳號的 Firestore 連帶清理（同一把服務帳號、同一個 token 快取）
const firestoreAdmin = serviceAccount
  ? createFirestoreAdminClient({ projectId: adminProjectId, getAccessToken: adminTokenProvider.getAccessToken })
  : null;
if (serviceAccount) console.log(`[admin] 服務帳號已載入：${serviceAccount.clientEmail}`);
else console.log('[admin] 未設定 FIREBASE_SERVICE_ACCOUNT_JSON——/api/admin/* 停用（503）');

// Anthropic 金鑰有效性：啟動探測一次並記 log；健康檢查回 apiKeyValid（1 小時快取）
const keyProbe = createKeyProbe({ apiKey: config.anthropic.apiKey, baseURL: config.anthropic.baseURL });
keyProbe.check().then((r) => {
  if (r.valid === false) console.error(`[anthropic] API key 無效（HTTP ${r.status}）——線上 AI 功能全部會回 401/503，請到 Zeabur 更新 ANTHROPIC_API_KEY`);
  else if (r.valid === null) console.warn('[anthropic] API key 探測未完成：', r.reason || `HTTP ${r.status}`);
  else console.log('[anthropic] API key 有效');
});

if (config.requireAuth && !allowlistEnabled(allowlist)) {
  console.warn('[auth] 未設定 ALLOWED_EMAILS/ALLOWED_EMAIL_DOMAINS——任何有效 Firebase 登入都可呼叫 AI 端點（成本面未上鎖）');
}

app.use(
  '/*',
  cors({
    origin: config.allowedOrigins.includes('*') ? '*' : config.allowedOrigins,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
);

// auth：REQUIRE_AUTH=true 時驗證 Firebase ID token（簽章 + claims）
app.use('/api/*', async (c, next) => {
  if (config.requireAuth) {
    if (c.req.method === 'OPTIONS') return next(); // 預檢不需 token
    const auth = c.req.header('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return c.json({ error: { code: 'IDO_PERMISSION_DENIED', message: '需要登入' } }, 401);
    }
    const token = auth.slice('Bearer '.length).trim();
    try {
      const payload = await verifyFirebaseIdToken(token, config.firebaseProjectId);
      c.set('user', {
        uid: payload.sub,
        email: payload.email || null,
        emailVerified: payload.email_verified === true, // email／密碼帳號未驗證前 email 不可信
      });
      c.set('idToken', token);
    } catch (e) {
      console.warn('[auth]', e?.message);
      return c.json({ error: { code: 'IDO_TOKEN_INVALID', message: '登入憑證無效或已過期' } }, 401);
    }
    // 管理端點不套 AI 白名單（管理員未必在 AI 名單內）；它有自己更嚴的守門（下方 /api/admin/* 中介層）
    if (c.req.path.startsWith('/api/admin/')) return next();
    // 白名單（啟用時）：環境變數保底 ∪ 管理頁名單（platform/aiAllowlist，60s 快取）。
    // 名單比對之外還要求 email 已驗證（evaluateCaller）——email／密碼登入的 email 是自稱的。
    const caller = c.get('user');
    const remote = await getRemoteAllowlist(token, config.firebaseProjectId);
    const verdict = evaluateCaller(caller, mergeAllowlists(allowlist, remote));
    if (verdict === 'forbidden') {
      console.warn('[auth] 白名單拒絕：', caller?.email || '(token 無 email)');
      return c.json({ error: { code: 'IDO_FORBIDDEN', message: '此帳號未獲授權使用 AI 功能，請聯絡平台管理員' } }, 403);
    }
    if (verdict === 'unverified') {
      console.warn('[auth] email 未驗證：', caller?.email);
      return c.json({ error: { code: 'IDO_EMAIL_UNVERIFIED', message: '請先完成 email 驗證（帳號選單→寄送驗證信→點擊信中連結→我已驗證），再使用 AI 功能' } }, 403);
    }
  }
  return next();
});

// 簡易 rate limit（in-memory，per-IP；AI 端點 20/min，SDD §3.1）
const hits = new Map();
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next(); // 預檢不計入額度（cors 通常已先短路）
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'local';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 20) {
    return c.json({ error: { code: 'IDO_RATE_LIMIT', message: '請求過於頻繁，請稍後再試' } }, 429);
  }
  recent.push(now);
  hits.set(ip, recent);
  // 避免 hits Map 無界成長：超過上限時清掉所有過期 IP
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= 60000)) hits.delete(k);
  }
  return next();
});

app.get('/', async (c) => {
  const key = await keyProbe.check();
  return c.json({
    ok: true,
    service: 'ido-ai-service',
    hasApiKey: hasApiKey(),
    apiKeyValid: key.valid, // true／false／null（探測未完成）
    adminConfigured: Boolean(adminClient),
  });
});

// ── 管理端點（做法 A，2026-09-08）：平台管理員從 pages/admin.html 管 Firebase 帳號 ──────────
// 守門三層：(1) 有效 Firebase ID token（上方 auth 中介層）(2) email 已驗證且
// firestore.rules 認定為平台管理員（admin-guard 探測 platform/meta）(3) 服務帳號已設定。
app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  if (!config.requireAuth) {
    return c.json({ error: { code: 'IDO_ADMIN_NOT_CONFIGURED', message: '管理端點需 REQUIRE_AUTH=true' } }, 503);
  }
  const caller = c.get('user');
  if (!caller?.uid || caller.emailVerified !== true) {
    return c.json({ error: { code: 'IDO_ADMIN_ONLY', message: '僅限 email 已驗證的平台管理員' } }, 403);
  }
  const verdict = await checkPlatformAdmin({ uid: caller.uid, idToken: c.get('idToken') }, config.firebaseProjectId);
  if (verdict === 'denied') {
    console.warn('[admin] 非管理員嘗試：', caller.email);
    return c.json({ error: { code: 'IDO_ADMIN_ONLY', message: '此帳號沒有平台管理權限' } }, 403);
  }
  if (verdict !== 'admin') {
    return c.json({ error: { code: 'IDO_ADMIN_UPSTREAM', message: '管理員身分查核暫時失敗，請稍後重試' } }, 502);
  }
  if (!adminClient) {
    return c.json({ error: { code: 'IDO_ADMIN_NOT_CONFIGURED', message: '後端未設定 FIREBASE_SERVICE_ACCOUNT_JSON（Zeabur 環境變數）' } }, 503);
  }
  return next();
});

function adminError(c, e) {
  if (e instanceof ValidationError) return c.json({ error: { code: 'IDO_VALIDATION', message: e.message } }, 400);
  if (e instanceof AdminUpstreamError) {
    console.error('[admin] upstream', e.status, e.upstream);
    return c.json({ error: { code: 'IDO_ADMIN_UPSTREAM', message: e.message } }, 502);
  }
  console.error('[admin]', e?.message || e);
  return c.json({ error: { code: 'IDO_ADMIN_UPSTREAM', message: String(e?.message || e) } }, 502);
}

async function readJson(c) {
  try {
    return await c.req.json();
  } catch {
    throw new ValidationError('JSON 解析失敗');
  }
}

app.get('/api/admin/accounts', async (c) => {
  try {
    return c.json({ accounts: await adminClient.listAccounts() });
  } catch (e) {
    return adminError(c, e);
  }
});

app.post('/api/admin/accounts', async (c) => {
  try {
    const body = await readJson(c);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const displayName = validateDisplayName(body.displayName);
    const account = await adminClient.createAccount({ email, password, displayName });
    console.log('[admin]', c.get('user').email, 'create', email);
    return c.json({ account }, 201);
  } catch (e) {
    return adminError(c, e);
  }
});

app.post('/api/admin/accounts/:uid/password', async (c) => {
  try {
    const uid = validateUid(c.req.param('uid'));
    const body = await readJson(c);
    const password = validatePassword(body.password);
    await adminClient.setPassword(uid, password);
    console.log('[admin]', c.get('user').email, 'set-password', uid);
    return c.json({ ok: true });
  } catch (e) {
    return adminError(c, e);
  }
});

app.post('/api/admin/accounts/:uid/disabled', async (c) => {
  try {
    const uid = validateUid(c.req.param('uid'));
    const body = await readJson(c);
    if (typeof body.disabled !== 'boolean') throw new ValidationError('disabled 需為布林值');
    if (body.disabled && uid === c.get('user').uid) throw new ValidationError('不能停用自己的帳號');
    await adminClient.setDisabled(uid, body.disabled);
    console.log('[admin]', c.get('user').email, body.disabled ? 'disable' : 'enable', uid);
    return c.json({ ok: true });
  } catch (e) {
    return adminError(c, e);
  }
});

// 刪除帳號：不能刪自己；請求須重打目標 email（confirmEmail）防誤點；
// Auth 先刪（成功後才動 Firestore，避免「資料刪了帳號還在」）；platformUsers 目錄項一定刪，
// users/{uid} 工作簿資料只有 purgeData=true 才遞迴刪。Firestore 清理失敗不回滾 Auth 刪除，
// 以 purge.error 回報讓管理員知道有殘留。第四堂 evalProjects 的成員資格不動（由專案 owner 處理）。
app.post('/api/admin/accounts/:uid/delete', async (c) => {
  try {
    const uid = validateUid(c.req.param('uid'));
    const body = await readJson(c);
    const caller = c.get('user');
    if (uid === caller.uid) throw new ValidationError('不能刪除自己的帳號');
    const target = await adminClient.lookupByUid(uid);
    if (!target) throw new ValidationError('找不到此帳號');
    const confirmEmail = String(body.confirmEmail || '').trim().toLowerCase();
    if (!target.email || confirmEmail !== target.email.toLowerCase()) {
      throw new ValidationError('確認用的 email 與目標帳號不符');
    }
    const purgeData = body.purgeData === true;
    await adminClient.deleteAccount(uid);
    const purge = { platformProfile: false, userDocs: 0 };
    try {
      await firestoreAdmin.deleteDocument(`platformUsers/${uid}`);
      purge.platformProfile = true;
      if (purgeData) purge.userDocs = await firestoreAdmin.purgeUserData(uid);
    } catch (e) {
      purge.error = String(e?.message || e);
      console.error('[admin] delete: Firestore 清理失敗', uid, purge.error);
    }
    console.log('[admin]', caller.email, 'delete', target.email, uid, JSON.stringify(purge));
    return c.json({ ok: true, deleted: { uid, email: target.email }, purge });
  } catch (e) {
    return adminError(c, e);
  }
});

app.get('/api/admin/auth-config', async (c) => {
  try {
    return c.json(await adminClient.getAuthConfig());
  } catch (e) {
    return adminError(c, e);
  }
});

app.post('/api/admin/auth-config', async (c) => {
  try {
    const body = await readJson(c);
    const result = await adminClient.applyAuthConfig({
      emailPassword: true,
      disableSignup: body.disableSignup !== false,
    });
    console.log('[admin]', c.get('user').email, 'auth-config', JSON.stringify(result));
    return c.json(result);
  } catch (e) {
    return adminError(c, e);
  }
});

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}

// AI 任務（AI-01 洞察 / AI-03 模版三評分 / AI-04 排序）→ draft 建議（人在迴路）
app.post('/api/ai/tasks', async (c) => {
  if (!hasApiKey()) return c.json({ error: { code: 'IDO_AI_NO_KEY', message: '伺服器未設定 API key' } }, 503);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'IDO_VALIDATION', message: 'JSON 解析失敗' } }, 400);
  }
  const task = TASKS[body.taskCode];
  if (!task || task.stream) {
    return c.json({ error: { code: 'IDO_VALIDATION_TASK', message: '未知或不支援的任務' } }, 400);
  }
  try {
    const safeInput = sanitizeObject(body.input || {});
    const { text, stopReason, usage, model } = await callClaude({ tier: task.model, system: task.system, user: task.buildUser(safeInput) });
    // Claude 5 分類器拒絕（HTTP 200 + refusal + 空 content）與長度截斷都不是解析錯誤——
    // 分流成可行動的錯誤訊息，避免使用者對著 IDO_AI_PARSE_ERROR 盲目重試。
    if (stopReason === 'refusal') {
      return c.json({ error: { code: 'IDO_AI_REFUSAL', message: 'AI 安全機制拒絕了此內容，請調整輸入後重試' } }, 400);
    }
    if (stopReason === 'max_tokens') {
      return c.json({ error: { code: 'IDO_AI_TRUNCATED', message: 'AI 輸出超過長度上限而截斷，請精簡輸入或稍後重試' } }, 502);
    }
    let payload = text;
    let confidence = null;
    if (task.json) {
      const parsed = parseJson(text);
      if (!parsed) return c.json({ error: { code: 'IDO_AI_PARSE_ERROR', message: 'AI 輸出解析失敗' } }, 502);
      payload = task.normalize ? task.normalize(parsed) : parsed;
      // 容錯：模型可能把 confidence 回成字串（'0.8'）或省略；解析失敗才視為未知
      const rawConf = parsed.confidence;
      confidence =
        typeof rawConf === 'number'
          ? rawConf
          : rawConf != null && rawConf !== '' && Number.isFinite(Number(rawConf))
          ? Number(rawConf)
          : null;
    }
    return c.json({ taskCode: body.taskCode, state: 'draft', payload, confidence, model, usage });
  } catch (e) {
    console.error('[ai/tasks]', e?.status, e?.message);
    // 上游 401/403＝伺服器金鑰無效或無權限：對使用者是「平台設定問題」，不要把原始 JSON 丟到畫面
    if (e?.status === 401 || e?.status === 403) {
      keyProbe.check({ force: true }).catch(() => {});
      return c.json({ error: { code: 'IDO_AI_KEY_INVALID', message: 'AI 服務的金鑰無效或已失效，請聯絡平台管理員（Zeabur 後端 ANTHROPIC_API_KEY）' } }, 503);
    }
    return c.json({ error: { code: 'IDO_AI_ERROR', message: String(e?.message || e) } }, 502);
  }
});

// 教練對話（AI-07，SSE 串流）
app.post('/api/ai/coach', async (c) => {
  if (!hasApiKey()) return c.json({ error: { code: 'IDO_AI_NO_KEY', message: '伺服器未設定 API key' } }, 503);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'IDO_VALIDATION', message: 'JSON 解析失敗' } }, 400);
  }
  const task = TASKS['AI-07'];
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: sanitizeText(m.content) }));
  if (messages.length === 0) return c.json({ error: { code: 'IDO_VALIDATION', message: '無對話內容' } }, 400);

  return streamSSE(c, async (stream) => {
    try {
      const s = streamClaude({ tier: task.model, system: task.system, messages });
      let deltaCount = 0;
      let stopReason = null;
      for await (const event of s) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          deltaCount += 1;
          await stream.writeSSE({ event: 'coach.delta', data: JSON.stringify({ delta: event.delta.text }) });
        } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
      }
      // Claude 5 分類器可在串流開始前或中途拒絕（HTTP 200＋stop_reason refusal）——
      // 兩者都不能以 done 收尾，否則前端把空白／被退回的部分回覆當成完整答案。
      if (stopReason === 'refusal' || deltaCount === 0) {
        await stream.writeSSE({ event: 'coach.error', data: JSON.stringify({ message: 'AI 未完成回覆（可能被安全機制拒絕），請調整訊息後重試' }) });
        return;
      }
      if (stopReason === 'max_tokens') console.warn('[ai/coach] reply truncated at max_tokens');
      await stream.writeSSE({ event: 'coach.done', data: JSON.stringify({ ok: true, ...(stopReason === 'max_tokens' ? { truncated: true } : {}) }) });
    } catch (e) {
      console.error('[ai/coach]', e?.status, e?.message);
      const message = (e?.status === 401 || e?.status === 403)
        ? 'AI 服務的金鑰無效或已失效，請聯絡平台管理員'
        : String(e?.message || e);
      await stream.writeSSE({ event: 'coach.error', data: JSON.stringify({ message }) });
    }
  });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ido-ai-service listening on :${info.port} (apiKey=${hasApiKey()})`);
});

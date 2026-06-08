import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { config, hasApiKey } from './config.js';
import { callClaude, streamClaude } from './anthropic.js';
import { sanitizeObject, sanitizeText } from './sanitize.js';
import { TASKS } from './prompts.js';
import { verifyFirebaseIdToken } from './firebase-auth.js';

const app = new Hono();

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
      c.set('user', { uid: payload.sub, email: payload.email || null });
    } catch (e) {
      console.warn('[auth]', e?.message);
      return c.json({ error: { code: 'IDO_TOKEN_INVALID', message: '登入憑證無效或已過期' } }, 401);
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

app.get('/', (c) => c.json({ ok: true, service: 'ido-ai-service', hasApiKey: hasApiKey() }));

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
    const { text, usage, model } = await callClaude({ tier: task.model, system: task.system, user: task.buildUser(safeInput) });
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
      for await (const event of s) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          await stream.writeSSE({ event: 'coach.delta', data: JSON.stringify({ delta: event.delta.text }) });
        }
      }
      await stream.writeSSE({ event: 'coach.done', data: JSON.stringify({ ok: true }) });
    } catch (e) {
      console.error('[ai/coach]', e?.status, e?.message);
      await stream.writeSSE({ event: 'coach.error', data: JSON.stringify({ message: String(e?.message || e) }) });
    }
  });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ido-ai-service listening on :${info.port} (apiKey=${hasApiKey()})`);
});

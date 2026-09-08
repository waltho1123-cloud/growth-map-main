// Firebase Auth 管理操作（Identity Toolkit REST，服務帳號 OAuth token）。
// 管理員從 pages/admin.html 建帳號、設密碼、停用／啟用、開關登入方式——學員零 Firebase 接觸。
// 管理員建立或設密碼的帳號一律 emailVerified=true（管理員背書），讓 firestore.rules 與
// AI 白名單的 email_verified 守門直接放行，不必寄驗證信。刪除帳號（2026-09-09 補）：
// Auth 帳號刪除在此；Firestore 連帶清理在 admin-firestore.js（目錄項一定刪、工作簿資料選刪）。

const IDP = 'https://identitytoolkit.googleapis.com';

export class ValidationError extends Error {}

export class AdminUpstreamError extends Error {
  constructor(message, status, upstream) {
    super(message);
    this.status = status;
    this.upstream = upstream;
  }
}

const UPSTREAM_TEXT = {
  EMAIL_EXISTS: '此 email 已有帳號',
  INVALID_EMAIL: 'email 格式不正確',
  WEAK_PASSWORD: '密碼強度不足',
  USER_NOT_FOUND: '找不到此帳號',
  PERMISSION_DENIED: '服務帳號權限不足（需 Firebase Authentication Admin 角色）',
  INSUFFICIENT_PERMISSION: '服務帳號權限不足（需 Firebase Authentication Admin 角色）',
  CONFIGURATION_NOT_FOUND: 'Firebase 專案尚未初始化 Authentication（請在 Console 開啟一次）',
};

export function describeUpstream(msg) {
  const key = String(msg || '').split(/[\s:]/)[0];
  return UPSTREAM_TEXT[key] ? `${UPSTREAM_TEXT[key]}（${key}）` : `Firebase 管理 API 錯誤：${msg || '未知'}`;
}

export function validateEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm) || norm.length > 254) throw new ValidationError('email 格式不正確');
  return norm;
}

export function validatePassword(password) {
  const pw = String(password ?? '');
  if (pw.length < 8 || pw.length > 128) throw new ValidationError('密碼需 8–128 碼');
  if (pw !== pw.trim()) throw new ValidationError('密碼首尾不可有空白');
  return pw;
}

export function validateDisplayName(name) {
  const s = String(name ?? '').trim();
  if (s.length > 100) throw new ValidationError('顯示名稱最多 100 字');
  return s;
}

export function validateUid(uid) {
  const s = String(uid || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw new ValidationError('uid 格式不正確');
  return s;
}

// Identity Toolkit 使用者紀錄 → 管理頁視圖（只露出管理需要的欄位）
export function toAdminView(u) {
  return {
    uid: u?.localId || '',
    email: u?.email || '',
    displayName: u?.displayName || '',
    emailVerified: u?.emailVerified === true,
    disabled: u?.disabled === true,
    providers: (u?.providerUserInfo || []).map((p) => p?.providerId).filter(Boolean),
    createdAt: Number(u?.createdAt) || null,
    lastLoginAt: Number(u?.lastLoginAt) || null,
  };
}

export function summarizeAuthConfig(cfg) {
  return {
    emailPasswordEnabled: cfg?.signIn?.email?.enabled === true,
    signUpDisabled: cfg?.client?.permissions?.disabledUserSignup === true,
    authorizedDomains: Array.isArray(cfg?.authorizedDomains) ? cfg.authorizedDomains : [],
  };
}

export function createIdentityToolkitClient({ projectId, getAccessToken, fetchImpl = fetch }) {
  if (!projectId) throw new Error('缺少 projectId');

  async function call(method, path, body, { admin = false } = {}) {
    const token = await getAccessToken();
    const url = `${IDP}${admin ? '/admin/v2' : '/v1'}/projects/${projectId}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      throw new AdminUpstreamError(describeUpstream(msg), res.status, msg);
    }
    return json;
  }

  return {
    async listAccounts() {
      const out = [];
      let pageToken = '';
      do {
        const q = new URLSearchParams({ maxResults: '500' });
        if (pageToken) q.set('nextPageToken', pageToken);
        const json = await call('GET', `/accounts:batchGet?${q}`);
        out.push(...(json.users || []).map(toAdminView));
        pageToken = json.nextPageToken || '';
      } while (pageToken);
      return out;
    },
    async createAccount({ email, password, displayName }) {
      const json = await call('POST', '/accounts', {
        email,
        password,
        ...(displayName ? { displayName } : {}),
        emailVerified: true,
      });
      return { uid: json.localId, email: json.email || email };
    },
    async setPassword(uid, password) {
      await call('POST', '/accounts:update', { localId: uid, password, emailVerified: true });
    },
    async setDisabled(uid, disabled) {
      await call('POST', '/accounts:update', { localId: uid, disableUser: disabled === true });
    },
    async setEmailVerified(uid, verified = true) {
      await call('POST', '/accounts:update', { localId: uid, emailVerified: verified === true });
    },
    async lookupByEmail(email) {
      const json = await call('POST', '/accounts:lookup', { email: [email] });
      const u = (json.users || [])[0];
      return u ? toAdminView(u) : null;
    },
    async lookupByUid(uid) {
      const json = await call('POST', '/accounts:lookup', { localId: [uid] });
      const u = (json.users || [])[0];
      return u ? toAdminView(u) : null;
    },
    async deleteAccount(uid) {
      await call('POST', '/accounts:delete', { localId: uid });
    },
    async getAuthConfig() {
      return summarizeAuthConfig(await call('GET', '/config', undefined, { admin: true }));
    },
    // 啟用 Email/Password 供應商＋關閉自助註冊；permissions 先讀現值再合併，避免 PATCH 整包蓋掉其他旗標
    async applyAuthConfig({ emailPassword = true, disableSignup = true } = {}) {
      const current = await call('GET', '/config', undefined, { admin: true });
      const permissions = { ...(current?.client?.permissions || {}), disabledUserSignup: disableSignup === true };
      const body = {
        signIn: { email: { enabled: emailPassword === true, passwordRequired: true } },
        client: { permissions },
      };
      const cfg = await call('PATCH', '/config?updateMask=signIn.email,client.permissions', body, { admin: true });
      return summarizeAuthConfig(cfg);
    },
  };
}

// Firestore 管理操作（服務帳號 OAuth token 走 REST；特權存取不受 security rules 限制）。
// 目前只用於「刪除帳號」的連帶清理：platformUsers/{uid} 目錄項一定刪；
// users/{uid} 工作簿資料（單元一～三）只有管理員勾選 purgeData 才遞迴刪除（不可復原）。
// Firestore 不會連帶刪子集合，所以遞迴：listCollectionIds → 列文件 → 逐份刪 → 刪父文件。
const FS = 'https://firestore.googleapis.com/v1';

export class FirestoreAdminError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function createFirestoreAdminClient({ projectId, getAccessToken, fetchImpl = fetch }) {
  if (!projectId) throw new Error('缺少 projectId');
  const base = `${FS}/projects/${projectId}/databases/(default)/documents`;

  async function call(method, url, body) {
    const token = await getAccessToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
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
      throw new FirestoreAdminError(`Firestore 管理 API 錯誤：${json?.error?.message || `HTTP ${res.status}`}`, res.status);
    }
    return json;
  }

  // 完整資源名 → 相對於 documents 根的路徑（users/u1/apps/momentum）
  const relPath = (name) => String(name).split('/documents/')[1] || '';

  async function listCollectionIds(docPath) {
    const ids = [];
    let pageToken = '';
    do {
      const json = await call('POST', `${base}/${docPath}:listCollectionIds`, { pageSize: 100, ...(pageToken ? { pageToken } : {}) });
      ids.push(...(json.collectionIds || []));
      pageToken = json.nextPageToken || '';
    } while (pageToken);
    return ids;
  }

  async function listDocumentPaths(collPath) {
    const paths = [];
    let pageToken = '';
    do {
      const q = new URLSearchParams({ pageSize: '300' });
      if (pageToken) q.set('pageToken', pageToken);
      const json = await call('GET', `${base}/${collPath}?${q}`);
      paths.push(...(json.documents || []).map((d) => relPath(d.name)).filter(Boolean));
      pageToken = json.nextPageToken || '';
    } while (pageToken);
    return paths;
  }

  // 建立文件（auto id）：稽核紀錄 adminLogs 用；回傳相對路徑
  async function createDocument(collPath, data) {
    const json = await call('POST', `${base}/${collPath}`, { fields: toFirestoreFields(data) });
    return relPath(json.name);
  }

  // 刪不存在的文件 Firestore 也回 200，呼叫端不必先查
  async function deleteDocument(docPath) {
    await call('DELETE', `${base}/${docPath}`);
    return true;
  }

  // 遞迴刪除一份文件與其所有子集合；回傳刪掉的文件數（含自身）。maxDocs 是安全閥。
  async function deleteTree(docPath, { maxDepth, maxDocs, counter }) {
    if (maxDepth <= 0) throw new FirestoreAdminError(`子集合層數超過上限：${docPath}`, 400);
    for (const coll of await listCollectionIds(docPath)) {
      for (const child of await listDocumentPaths(`${docPath}/${coll}`)) {
        await deleteTree(child, { maxDepth: maxDepth - 1, maxDocs, counter });
      }
    }
    if (counter.n >= maxDocs) throw new FirestoreAdminError(`刪除文件數超過安全上限 ${maxDocs}`, 400);
    await deleteDocument(docPath);
    counter.n += 1;
  }

  async function purgeUserData(uid, { maxDepth = 5, maxDocs = 2000 } = {}) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid))) throw new FirestoreAdminError('uid 格式不正確', 400);
    const counter = { n: 0 };
    await deleteTree(`users/${uid}`, { maxDepth, maxDocs, counter });
    return counter.n;
  }

  return { listCollectionIds, listDocumentPaths, createDocument, deleteDocument, purgeUserData };
}

// JS 值 → Firestore REST typed value（只涵蓋稽核紀錄會用到的型別；undefined 欄位略過）
export function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

export function toFirestoreFields(obj) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toFirestoreValue(v)])
  );
}

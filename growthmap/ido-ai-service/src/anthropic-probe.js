// Anthropic 金鑰有效性探測（2026-09-09 補）：健康檢查原本只回 hasApiKey（有沒有設），
// 金鑰被撤銷時線上 AI 全掛而 `/` 仍顯示正常，誤導診斷。改為啟動時與健康檢查（TTL 內快取）
// 打一次免費的 GET /v1/models：200＝有效、401＝無效、其他／網路錯誤＝unknown（不當成壞）。
export function createKeyProbe({ apiKey, baseURL, fetchImpl = fetch, now = Date.now, ttlMs = 60 * 60_000 }) {
  let cached = null; // { valid: true|false|null, status, checkedAt }
  let inflight = null;

  async function probe() {
    if (!apiKey) return { valid: false, status: 0, checkedAt: now(), reason: 'no-key' };
    const base = (baseURL || 'https://api.anthropic.com').replace(/\/+$/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetchImpl(`${base}/v1/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        signal: ctrl.signal,
      });
      const valid = res.status === 200 ? true : res.status === 401 || res.status === 403 ? false : null;
      return { valid, status: res.status, checkedAt: now() };
    } catch (e) {
      return { valid: null, status: 0, checkedAt: now(), reason: e?.message || String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async check({ force = false } = {}) {
      if (!force && cached && now() - cached.checkedAt < ttlMs) return cached;
      if (!inflight) inflight = probe().then((r) => { cached = r; return r; }).finally(() => { inflight = null; });
      return inflight;
    },
    peek() {
      return cached;
    },
  };
}

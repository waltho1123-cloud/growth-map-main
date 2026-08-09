// 前端 AI 客戶端：呼叫 ido-ai-service。AI 產出皆為 draft，需使用者採納才生效（ADR-004/GD-04）。
// 未設定 VITE_AI_BASE_URL 時 AI 功能停用（優雅降級，GD-06）。
const AI_BASE = (import.meta.env.VITE_AI_BASE_URL || '').replace(/\/$/, '');

export const isAiEnabled = () => Boolean(AI_BASE);

// 取得 Firebase ID token header。forceRefresh=true 時強制向 Firebase 換新 token
// （用於 token 過期導致後端回 401 時重試）。
async function authHeader(forceRefresh = false) {
  try {
    const { getFirebase } = await import('../cloud/firebase');
    const { auth } = await getFirebase();
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken(forceRefresh);
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    /* 未登入或 Firebase 未配置：略過 token */
  }
  return {};
}

// AI-01 / AI-03 / AI-04 → 回 { taskCode, state:'draft', payload, confidence, model }
export async function runAiTask(taskCode, input) {
  if (!AI_BASE) throw new Error('AI 服務未設定');
  const body = JSON.stringify({ taskCode, input });
  const send = async (forceRefresh) =>
    fetch(`${AI_BASE}/api/ai/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(forceRefresh)) },
      body,
    });
  let res = await send(false);
  // token 可能已過期：強制刷新後重試一次
  if (res.status === 401) res = await send(true);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `AI 任務失敗（${res.status}）`);
  return data;
}

// AI-07 教練對話（SSE 串流）。onDelta(textChunk) 逐塊回呼。
export async function streamCoach(messages, onDelta, signal) {
  if (!AI_BASE) throw new Error('AI 服務未設定');
  const send = async (forceRefresh) =>
    fetch(`${AI_BASE}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(forceRefresh)) },
      body: JSON.stringify({ messages }),
      signal,
    });
  let res = await send(false);
  if (res.status === 401) res = await send(true);
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || '教練服務連線失敗');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      let event = '';
      let data = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (event === 'coach.delta' && data) {
        let delta = null;
        try { delta = JSON.parse(data).delta || ''; } catch { /* 畸形 SSE 分塊直接略過，等下一塊 */ }
        // onDelta 放在 try 外：回呼自身的例外要往上傳，不可被當成畸形分塊吞掉
        if (delta !== null) onDelta(delta);
      } else if (event === 'coach.error' && data) {
        let message = '教練服務回報錯誤';
        try { message = JSON.parse(data).message || message; } catch { /* error payload 非 JSON 時用預設訊息 */ }
        throw new Error(message);
      }
    }
  }
}

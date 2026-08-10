// AI client（P-15 四模式）——呼叫 ido-ai-service /api/ai/tasks。
// GD-06：未設 VITE_AI_BASE_URL＝AI 功能整組優雅停用（不顯示、不報錯）。
// REQUIRE_AUTH=true 時帶 Firebase ID token；401 IDO_TOKEN_INVALID 強制刷新重試一次
// （與 opportunity-system 的前端行為一致）。

import { getFirebase } from './cloud/firebase';

const BASE = import.meta.env.VITE_AI_BASE_URL || '';

export const aiEnabled = !!BASE;

async function idToken(forceRefresh = false) {
  const { auth } = await getFirebase();
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

async function post(path, body, { retryOn401 = true } = {}) {
  const token = await idToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && data?.error?.code === 'IDO_TOKEN_INVALID' && retryOn401) {
      await idToken(true);
      return post(path, body, { retryOn401: false });
    }
    throw new Error(data?.error?.message || `AI 服務錯誤（HTTP ${res.status}）`);
  }
  return data;
}

export const AI_MODES = Object.freeze([
  Object.freeze({
    key: 'hat', taskCode: 'EVA-HAT', label: '戴帽子發想', model: 'opus',
    hint: '換人當 CEO 破框：「如果 Elon Musk 接手這家公司，他會怎麼看這個機會？」',
    inputLabel: '扮演視角（留空＝顛覆型 CEO）', inputField: 'persona',
  }),
  Object.freeze({
    key: 'redteam', taskCode: 'EVA-REDTEAM', label: '紅隊挑戰', model: 'opus',
    hint: '找邏輯漏洞：「這個方案要成立，我們得先證明什麼？」',
    inputLabel: '挑戰對象（留空＝整體方案組合）', inputField: 'target',
  }),
  Object.freeze({
    key: 'reverse', taskCode: 'EVA-REVERSE', label: '反推題', model: 'sonnet',
    hint: '由目標反推條件：「若投資人期待 TSR 15%、營收成長 10%，利潤率需達多少？」',
    inputLabel: '目標（必填，例：三年營收翻倍且 EBIT ≥ 12%）', inputField: 'goal',
  }),
  Object.freeze({
    key: 'scan', taskCode: 'EVA-SCAN', label: '業界掃描', model: 'sonnet',
    hint: '同業與跨業做法（模型知識、非即時資料，低確定度需自行查證）',
    inputLabel: '賽道／主題（必填）', inputField: 'topic',
  }),
]);

// 呼叫四模式任務；回 { payload: { hypotheses: [{title, content}] }, confidence, model, usage }
export function callEvaMode(mode, fieldValue, context) {
  return post('/api/ai/tasks', {
    taskCode: mode.taskCode,
    input: { [mode.inputField]: fieldValue, context },
  });
}

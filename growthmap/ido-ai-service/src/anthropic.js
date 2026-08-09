import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  ...(config.anthropic.baseURL ? { baseURL: config.anthropic.baseURL } : {}),
});

function modelFor(tier) {
  return config.models[tier] || config.models.sonnet;
}

// 非串流：回完整文字（AI-01/03/04）。
// maxTokens 8000：Claude 5 系列 adaptive thinking 預設開啟且與回覆共用此上限，
// 加上新 tokenizer 用量較高，4000 會有截斷（→ JSON 解析失敗）風險。
// stopReason 必須回傳給呼叫端分流：Claude 5 的安全分類器會以 HTTP 200 +
// stop_reason 'refusal' + 空 content 拒絕請求，不檢查會被誤判成 JSON 解析錯誤。
export async function callClaude({ tier, system, user, maxTokens = 8000 }) {
  const msg = await client.messages.create({
    model: modelFor(tier),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { text, stopReason: msg.stop_reason, usage: msg.usage, model: msg.model };
}

// 串流：回 Anthropic 串流物件（AI-07 教練對話）
export function streamClaude({ tier, system, messages, maxTokens = 16000 }) {
  return client.messages.stream({
    model: modelFor(tier),
    max_tokens: maxTokens,
    system,
    messages,
  });
}

export { client };

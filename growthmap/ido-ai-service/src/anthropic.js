import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  ...(config.anthropic.baseURL ? { baseURL: config.anthropic.baseURL } : {}),
});

function modelFor(tier) {
  return config.models[tier] || config.models.sonnet;
}

// 非串流：回完整文字（AI-01/03/04）
export async function callClaude({ tier, system, user, maxTokens = 4000 }) {
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
  return { text, usage: msg.usage, model: msg.model };
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

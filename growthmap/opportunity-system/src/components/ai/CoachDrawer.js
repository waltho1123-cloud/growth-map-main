import React, { useState } from 'react';
import { useNav } from '../../contexts/NavContext';
import { isAiEnabled, streamCoach } from '../../lib/ai/aiClient';
import toast from 'react-hot-toast';

// AI 教練對話抽屜（AI-07，SSE 串流）。教練僅提供方法論引導，不代為拍板（鐵則 4）。
export default function CoachDrawer() {
  const { coachOpen, toggleCoach } = useNav();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  if (!isAiEnabled() || !coachOpen) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    try {
      await streamCoach(next, (delta) => {
        setMessages((cur) => {
          const copy = [...cur];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: 'assistant', content: (last?.content || '') + delta };
          return copy;
        });
      });
    } catch (e) {
      toast.error(e.message || '教練連線失敗');
      setMessages((cur) => (cur[cur.length - 1]?.content ? cur : cur.slice(0, -1)));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={toggleCoach} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl flex flex-col animate-slide-in">
        <div className="glass-header px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">AI 教練</h3>
            <p className="text-xs text-gray-400">方法論引導，不代為決策（鐵則 4）</p>
          </div>
          <button onClick={toggleCoach} className="text-gray-400 hover:text-gray-700" aria-label="關閉">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400">針對識別機會步驟提問，例如：「異常分析要怎麼找出機會？」「我的長清單不夠對齊原型，怎麼調整？」</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <span
                className={`inline-block px-3 py-2 rounded-lg text-sm whitespace-pre-wrap max-w-[85%] text-left ${
                  m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {m.content || '…'}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200/60 p-3 shrink-0 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="向 AI 教練提問…"
            disabled={streaming}
            className="flex-1 rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm px-3 py-2"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {streaming ? '…' : '送出'}
          </button>
        </div>
      </div>
    </div>
  );
}

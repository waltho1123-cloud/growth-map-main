/* eslint-disable react-refresh/only-export-components -- 本檔是共用 UI 工具箱，
   刻意同時輸出元件、tone 常數與 useDraft hook；不依賴 fast refresh 邊界 */
// 小型共用 UI 元件（PRD 7.4 共用元件庫的輕量落地）

import { useState } from 'react';

// 狀態色 tone → Tailwind class（PRD 7.2.2 狀態色）
export const TONE = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  fail: { dot: 'bg-red-500', text: 'text-red-700', chip: 'bg-red-50 text-red-700 border-red-200' },
  idle: { dot: 'bg-slate-300', text: 'text-slate-500', chip: 'bg-slate-50 text-slate-500 border-slate-200' },
  brand: { dot: 'bg-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export function Chip({ tone = 'idle', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone].chip}`}>
      {children}
    </span>
  );
}

// CheckLamp：綠/黃/紅＋理由（P-01、P-13）
export function Lamp({ lamp }) {
  const tone = lamp === 'pass' ? 'ok' : lamp === 'warn' ? 'warn' : lamp === 'fail' ? 'fail' : 'idle';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${TONE[tone].dot}`} />;
}

// GuardBadge：GR-N 標記＋修正提示（hover）
export function GuardBadge({ code, reason, tone = 'warn' }) {
  return (
    <span className="group relative inline-flex">
      <Chip tone={tone}>{code}</Chip>
      {reason ? (
        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-700 shadow-lg group-hover:block">
          {reason}
        </span>
      ) : null}
    </span>
  );
}

export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// 空狀態（PRD 7.8.1：有且僅有一個主要行動按鈕）
export function EmptyState({ text, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="max-w-md text-sm leading-relaxed text-slate-600">{text}</p>
      {actionLabel ? (
        <button type="button" onClick={onAction} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Btn({ children, onClick, kind = 'default', disabled, title, className = '', type = 'button' }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
    default: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles[kind]} ${className}`}>
      {children}
    </button>
  );
}

// 草稿輸入：本地編輯、失焦提交（避免每鍵擊寫 Firestore；外部值變動時跟進）。
// 外部值同步採「render 期調整 state」模式（React 官方 adjusting-state-during-render），
// 不用 effect——effect 版會觸發 set-state-in-effect 的級聯渲染警告。
export function useDraft(value, commit) {
  const ext = value ?? '';
  const [state, setState] = useState({ draft: ext, base: ext, editing: false });
  if (!state.editing && state.base !== ext) {
    setState({ draft: ext, base: ext, editing: false });
  }
  return {
    value: state.editing ? state.draft : ext,
    onChange: (e) => {
      const next = e?.target ? e.target.value : e;
      setState((s) => ({ ...s, draft: next, editing: true }));
    },
    onFocus: () => setState((s) => ({ ...s, draft: ext, editing: true })),
    onBlur: () => {
      const committed = state.editing ? state.draft : ext;
      setState({ draft: committed, base: ext, editing: false });
      if (ext !== committed) commit(committed);
    },
  };
}

export function TextInput({ value, onCommit, disabled, placeholder, className = '', type = 'text' }) {
  const d = useDraft(value, onCommit);
  return (
    <input type={type} value={d.value} onChange={d.onChange} onFocus={d.onFocus} onBlur={d.onBlur}
      disabled={disabled} placeholder={placeholder}
      className={`w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${className}`} />
  );
}

export function NumInput({ value, onCommit, disabled, placeholder, className = '' }) {
  const d = useDraft(value === 0 || value == null ? (value === 0 ? '0' : '') : String(value), (v) => {
    const n = Number(v);
    onCommit(v === '' || !Number.isFinite(n) ? 0 : n);
  });
  return (
    <input type="number" inputMode="decimal" value={d.value} onChange={d.onChange} onFocus={d.onFocus} onBlur={d.onBlur}
      disabled={disabled} placeholder={placeholder}
      className={`w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${className}`} />
  );
}

export function TextArea({ value, onCommit, disabled, placeholder, rows = 3, className = '' }) {
  const d = useDraft(value, onCommit);
  return (
    <textarea rows={rows} value={d.value} onChange={d.onChange} onFocus={d.onFocus} onBlur={d.onBlur}
      disabled={disabled} placeholder={placeholder}
      className={`w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm leading-relaxed text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${className}`} />
  );
}

// 條列編輯器（多筆長文字欄位：USP/步驟/KSF…）
export function ListEditor({ items, onCommit, disabled, placeholder = '新增一筆…', renderBadge }) {
  const [text, setText] = useState('');
  const list = Array.isArray(items) ? items : [];
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onCommit([...list, t]);
    setText('');
  };
  return (
    <div className="space-y-1.5">
      {list.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <span className="flex-1 text-sm leading-relaxed text-slate-800">{item}</span>
          {renderBadge?.(item)}
          {!disabled && (
            <button type="button" className="text-xs text-slate-400 hover:text-red-600"
              onClick={() => onCommit(list.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
          <Btn onClick={add}>加入</Btn>
        </div>
      )}
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`max-h-[85vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

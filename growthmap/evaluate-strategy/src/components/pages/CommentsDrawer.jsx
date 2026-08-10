import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { addSubDoc, updateSubDoc, deleteSubDoc } from '../../lib/db';
import { fmtTime } from '../../lib/format';
import { Btn, Chip, TextArea } from '../common/ui';

// 評論抽屜（FR-11-04）：唯一開放 coach 寫入的協作面（PRD §7.7 唯讀＋評論）。
// targetRef 可定位到機會/方案/財務儲存格；全域開啟時為專案級評論。
export default function CommentsDrawer({ ctx }) {
  const drawer = useUiStore((s) => s.drawer);
  const close = useUiStore((s) => s.closeDrawer);
  const project = useProjectStore((s) => s.project);
  const comments = useProjectStore((s) => s.comments);
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  if (!drawer || drawer.type !== 'comments') return null;

  const filtered = comments
    .filter((c) => (drawer.ref ? c.targetRef === drawer.ref : true))
    .filter((c) => (showResolved ? true : !c.resolved));

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    await addSubDoc(project.id, 'comments', {
      targetRef: drawer.ref || null,
      targetLabel: drawer.label || '',
      text: t,
      authorUid: ctx.user.uid,
      authorName: ctx.user.displayName || ctx.user.email || '',
      resolved: false,
      createdAt: Date.now(),
    });
    setText('');
  };

  return (
    <div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="absolute right-0 top-0 flex h-full w-[400px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">評論</h3>
            <p className="text-[11px] text-slate-400">{drawer.ref ? `鎖定：${drawer.label || drawer.ref}` : `全專案（${comments.length}）`}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              含已解決
            </label>
            <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {filtered.length === 0 && <p className="pt-8 text-center text-xs text-slate-400">目前沒有{showResolved ? '' : '未解決的'}評論。</p>}
          {filtered.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 ${c.resolved ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
              {c.targetLabel && <div className="mb-1 text-[11px] font-medium text-indigo-600">{c.targetLabel}</div>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{c.text}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{c.authorName}・{fmtTime(c.createdAt)}</span>
                {c.resolved && <Chip tone="idle">已解決</Chip>}
                <span className="ml-auto flex gap-2">
                  {ctx.editable && (
                    <button type="button" className="text-[11px] text-slate-400 hover:text-emerald-600"
                      onClick={() => updateSubDoc(project.id, 'comments', c.id, { resolved: !c.resolved })}>
                      {c.resolved ? '重開' : '標記解決'}
                    </button>
                  )}
                  {c.authorUid === ctx.user.uid && (
                    <button type="button" className="text-[11px] text-slate-300 hover:text-red-600"
                      onClick={() => deleteSubDoc(project.id, 'comments', c.id)}>刪除</button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* coach 也能寫（規則層放行 comments create） */}
        <div className="border-t border-slate-100 p-3">
          <TextArea rows={2} value={text} onCommit={setText}
            placeholder={drawer.ref ? '對這個項目留評論…' : '留一則專案級評論…'} />
          <div className="mt-1.5 flex justify-end">
            <Btn kind="primary" onClick={add}>送出評論</Btn>
          </div>
        </div>
      </aside>
    </div>
  );
}

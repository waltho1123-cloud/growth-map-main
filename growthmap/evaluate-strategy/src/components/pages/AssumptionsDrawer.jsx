import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { addSubDoc, updateSubDoc, deleteSubDoc } from '../../lib/db';
import { createAssumptionDoc } from '../../domain/model';
import { Btn, Chip, TextArea, TextInput } from '../common/ui';

const SOURCES = ['內部資料', '公開資料', '專家判斷', '相對倍數估算'];
const STATUS_LABEL = { unverified: '未驗證', verifying: '驗證中', verified: '已驗證', refuted: '已推翻' };
const METHODS = ['客戶深度訪談', '通路商訪談', '現場勘查', '公開資料', '試點'];

// P-16 假設與驗證登錄（全域右側抽屜）：沒有假設，就沒有數字（鐵則 5）
export default function AssumptionsDrawer({ ctx }) {
  const drawer = useUiStore((s) => s.drawer);
  const close = useUiStore((s) => s.closeDrawer);
  const project = useProjectStore((s) => s.project);
  const assumptions = useProjectStore((s) => s.assumptions);
  const [text, setText] = useState('');
  const [source, setSource] = useState('專家判斷');
  const [confidence, setConfidence] = useState('medium');
  const [evidenceFor, setEvidenceFor] = useState(null);
  const [evi, setEvi] = useState({ method: METHODS[0], sampleSize: '', date: '', conclusion: '' });

  if (!drawer || drawer.type !== 'assumptions') return null;

  const filtered = drawer.ref ? assumptions.filter((a) => a.target?.ref === drawer.ref) : assumptions;
  const disabled = !ctx.editable;

  const add = async () => {
    if (!text.trim()) return;
    await addSubDoc(project.id, 'assumptions', createAssumptionDoc({
      text: text.trim(),
      targetRef: drawer.ref,
      targetLabel: drawer.label,
      source,
      confidence,
      authorUid: ctx.user.uid,
      authorName: ctx.user.displayName || ctx.user.email || '',
    }));
    setText('');
  };

  const addEvidence = async (a) => {
    const evidence = [...(a.evidence || []), { ...evi, addedBy: ctx.user.uid, addedAt: Date.now() }];
    await updateSubDoc(project.id, 'assumptions', a.id, { evidence, status: a.status === 'unverified' ? 'verifying' : a.status });
    setEvidenceFor(null);
    setEvi({ method: METHODS[0], sampleSize: '', date: '', conclusion: '' });
  };

  return (
    <div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="absolute right-0 top-0 flex h-full w-[400px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">假設與驗證登錄</h3>
            <p className="text-[11px] text-slate-400">{drawer.ref ? `鎖定：${drawer.label || drawer.ref}` : `全部假設（${assumptions.length}）`}</p>
          </div>
          <div className="flex items-center gap-2">
            {drawer.ref && (
              <button type="button" className="text-[11px] text-indigo-600 hover:underline"
                onClick={() => useUiStore.getState().openAssumptions(null, '')}>看全部</button>
            )}
            <button type="button" onClick={close} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {filtered.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs leading-relaxed text-slate-500">
              尚無假設。{drawer.ref ? '為這個數字寫下你是怎麼推的。' : ''}
              新賽道查無市場資料時，建議「找 10 位潛在客戶進行深度訪談，從回答反推 TA 與願付溢價」。
            </p>
          )}
          {filtered.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 p-3">
              {a.target?.label && <div className="mb-1 text-[11px] font-medium text-indigo-600">{a.target.label}</div>}
              <p className="text-sm leading-relaxed text-slate-800">{a.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Chip tone="idle">{a.source}</Chip>
                <Chip tone={a.confidence === 'high' ? 'ok' : a.confidence === 'low' ? 'warn' : 'brand'}>
                  信心{{ high: '高', medium: '中', low: '低' }[a.confidence]}
                </Chip>
                {!disabled ? (
                  <select value={a.status} onChange={(e) => updateSubDoc(project.id, 'assumptions', a.id, { status: e.target.value })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-[11px] text-slate-600">
                    {Object.entries(STATUS_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                ) : (
                  <Chip tone={a.status === 'verified' ? 'ok' : a.status === 'refuted' ? 'fail' : 'idle'}>{STATUS_LABEL[a.status]}</Chip>
                )}
                <span className="ml-auto text-[10px] text-slate-400">{a.authorName}</span>
              </div>

              {(a.evidence || []).length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {(a.evidence || []).map((e, i) => (
                    <div key={i} className="rounded bg-slate-50 px-2 py-1 text-[11px] leading-relaxed text-slate-600">
                      <b>{e.method}</b>{e.sampleSize ? `｜樣本 ${e.sampleSize}` : ''}{e.date ? `｜${e.date}` : ''}
                      {e.conclusion ? ` — ${e.conclusion}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {!disabled && (
                evidenceFor === a.id ? (
                  <div className="mt-2 space-y-1.5 rounded-lg bg-indigo-50/60 p-2">
                    <select value={evi.method} onChange={(e) => setEvi({ ...evi, method: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs">
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-1.5">
                      <TextInput value={evi.sampleSize} onCommit={(v) => setEvi((c) => ({ ...c, sampleSize: v }))} placeholder="樣本數" />
                      <TextInput value={evi.date} onCommit={(v) => setEvi((c) => ({ ...c, date: v }))} placeholder="日期" />
                    </div>
                    <TextArea rows={2} value={evi.conclusion} onCommit={(v) => setEvi((c) => ({ ...c, conclusion: v }))} placeholder="結論…" />
                    <div className="flex justify-end gap-1.5">
                      <Btn kind="ghost" onClick={() => setEvidenceFor(null)}>取消</Btn>
                      <Btn kind="primary" onClick={() => addEvidence(a)}>存證據</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-between">
                    <button type="button" className="text-[11px] text-indigo-600 hover:underline" onClick={() => setEvidenceFor(a.id)}>＋ 掛驗證證據</button>
                    <button type="button" className="text-[11px] text-slate-300 hover:text-red-600" onClick={() => deleteSubDoc(project.id, 'assumptions', a.id)}>刪除</button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>

        {!disabled && (
          <div className="border-t border-slate-100 p-3">
            <TextArea rows={2} value={text} onCommit={setText}
              placeholder={drawer.ref ? '這個數字的假設（描述、依據、怎麼推的）…' : '新增一筆全案假設…'} />
            <div className="mt-1.5 flex items-center gap-1.5">
              <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                <option value="high">信心高</option><option value="medium">信心中</option><option value="low">信心低</option>
              </select>
              <Btn kind="primary" className="ml-auto" onClick={add}>登錄假設</Btn>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

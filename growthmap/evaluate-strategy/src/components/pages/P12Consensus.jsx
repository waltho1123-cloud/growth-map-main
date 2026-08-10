import { useProjectStore } from '../../store/useProjectStore';
import { updateProject } from '../../lib/db';
import { SANITY_QUESTIONS } from '../../domain/model';
import { Section, Chip, TextArea, ListEditor } from '../common/ui';

const IMPACTS = [
  ['positive', '正面', 'ok'],
  ['neutral', '中性', 'idle'],
  ['negative', '負面', 'warn'],
  ['severe', '高度負面', 'fail'],
];

// P-12 定位衝擊與共識：Sanity Check 七問＋WHY/WHAT/HOW＋CEO 敘事。
// 刻意置於流程最後——過早檢視衝擊會鉗制發想（PRD 設計註記）。
export default function P12Consensus({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const consensus = project?.consensus || {};
  const sanity = consensus.sanity || SANITY_QUESTIONS.map(() => ({ impact: '', note: '' }));
  const disabled = !ctx.editable;

  // field-path 寫入（consensus.xxx），不整包覆寫 consensus——七問/三欄/敘事各自獨立
  // 提交，兩人並行編輯不同區塊不互蓋。sanity 是陣列，Firestore 無法按索引更新，
  // 退而求其次以「整個 sanity 欄位」為粒度（仍窄於整包 consensus）。
  const patch = (p) => updateProject(
    project.id,
    Object.fromEntries(Object.entries(p).map(([k, v]) => [`consensus.${k}`, v]))
  );
  const patchSanity = (i, item) => patch({ sanity: sanity.map((x, j) => (j === i ? { ...x, ...item } : x)) });

  const answered = sanity.filter((x) => x.impact).length;
  const listsOk = ['why', 'what', 'how'].every((k) => (consensus[k] || []).length >= 2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">定位衝擊與共識</h2>
          <p className="text-xs text-slate-600">拍板前的 Sanity Check——本頁刻意放在流程最後，避免提早鉗制發想。</p>
        </div>
        <div className="flex gap-2">
          <Chip tone={answered === sanity.length ? 'ok' : 'idle'}>七問 {answered}/{sanity.length}</Chip>
          <Chip tone={listsOk ? 'ok' : 'idle'}>WHY/WHAT/HOW {listsOk ? '完成' : '各需 ≥2 筆'}</Chip>
        </div>
      </div>

      {/* 區 1 Sanity Check 七問 */}
      <div className="grid gap-3 md:grid-cols-2">
        {SANITY_QUESTIONS.map((q, i) => {
          const item = sanity[i] || { impact: '', note: '' };
          return (
            <Section key={q} title={`${i + 1}. ${q}`}>
              <div className="mb-2 flex flex-wrap gap-2">
                {IMPACTS.map(([v, label, tone]) => (
                  <button key={v} type="button" disabled={disabled}
                    onClick={() => patchSanity(i, { impact: v })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      item.impact === v
                        ? tone === 'fail' ? 'border-red-500 bg-red-600 text-white'
                          : tone === 'warn' ? 'border-amber-500 bg-amber-500 text-white'
                          : tone === 'ok' ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-slate-400 bg-slate-500 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              <TextArea rows={2} disabled={disabled} value={item.note}
                onCommit={(v) => patchSanity(i, { note: v })}
                placeholder={item.impact === 'severe' ? '高度負面：必須填寫因應說明' : '說明（選填）…'} />
              {item.impact === 'severe' && !(item.note || '').trim() && (
                <p className="mt-1 text-xs text-red-600">影響為「高度負面」時必須填寫因應說明。</p>
              )}
            </Section>
          );
        })}
      </div>

      {/* 區 2 WHY／WHAT／HOW 共識表 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Section title="WHY 選定這些策略方案的理由">
          <p className="mb-2 text-xs text-slate-500">各方案理由、方案間綜效、執行順序邏輯、主要風險（≥2 筆）</p>
          <ListEditor disabled={disabled} items={consensus.why} onCommit={(v) => patch({ why: v })} />
        </Section>
        <Section title="WHAT 未來目標狀態定義">
          <p className="mb-2 text-xs text-slate-500">業務組合、客戶組合、成長輪廓、價值主張（≥2 筆）</p>
          <ListEditor disabled={disabled} items={consensus.what} onCommit={(v) => patch({ what: v })} />
        </Section>
        <Section title="HOW 如何實現公司願景">
          <p className="mb-2 text-xs text-slate-500">既有業務綜效、多角化效益、客戶關係強化、與願景的連結（≥2 筆）</p>
          <ListEditor disabled={disabled} items={consensus.how} onCommit={(v) => patch({ how: v })} />
        </Section>
      </div>

      {/* 區 3 CEO 敘事自評 */}
      <Section title="CEO 敘事自評">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5" disabled={disabled}
            checked={!!consensus.ceoNarrative?.checked}
            onChange={(e) => patch({ ceoNarrative: { ...consensus.ceoNarrative, checked: e.target.checked } })} />
          我能不看投影片，從頭到尾把 WHY／WHAT／HOW 講成一個完整的故事。
        </label>
        <TextArea rows={3} className="mt-2" disabled={disabled}
          value={consensus.ceoNarrative?.note}
          onCommit={(v) => patch({ ceoNarrative: { ...consensus.ceoNarrative, note: v } })}
          placeholder="自評備註（哪一段還講不順、需要誰補資料）…" />
      </Section>
    </div>
  );
}

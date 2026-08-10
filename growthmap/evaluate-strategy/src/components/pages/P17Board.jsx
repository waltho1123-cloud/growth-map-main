import { useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { useDerived } from '../../hooks/useDerived';
import { updateProject } from '../../lib/db';
import { assumptionCoverage } from '../../domain/finance';
import { checkGr1 } from '../../domain/guards';
import { fmtTime } from '../../lib/format';
import { navigate } from '../../lib/useHashRoute';
import { Section, Chip, Btn } from '../common/ui';

const MATURITY = [50, 70, 90];
const STEPS = [
  { key: 'step1', label: '① 承接長清單', path: 'longlist' },
  { key: 'step2', label: '② 評估與排序', path: 'scoring' },
  { key: 'step3', label: '③ 收斂策略方案', path: 'plays' },
  { key: 'step4', label: '④ 高階商業計劃', path: 'bizplan' },
  { key: 'step5', label: '⑤ 疊加與時序', path: 'rollup' },
];

// P-17 協作、評論與進度看板＋草稿成熟度（FR-01-05/06）：
// 「降低標準、拉快速度」（鐵則 8）——先 50 分再迭代，看板讓卡點透明。
export default function P17Board({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const plays = useProjectStore((s) => s.plays);
  const assumptions = useProjectStore((s) => s.assumptions);
  const comments = useProjectStore((s) => s.comments);
  const aiLogs = useProjectStore((s) => s.aiLogs);
  const handoffs = useProjectStore((s) => s.handoffs);
  const openComments = useUiStore((s) => s.openComments);
  const { checkRun, years } = useDerived();

  const maturity = project?.maturity || {};
  const setMaturity = (key, pct) => updateProject(project.id, { [`maturity.${key}`]: pct });

  const memberName = (uid) => project?.members?.[uid]?.displayName || project?.members?.[uid]?.email || '未指派';

  // 待辦與複議清單
  const todos = useMemo(() => {
    const list = [];
    for (const o of opportunities) {
      if (o.lastAggregate?.needsReview && !o.excluded?.flag) {
        list.push({ kind: '複議', text: `「${o.opportunityName}」評分離散度過大`, path: 'scoring', owner: memberName(o.ownerUid) });
      }
      if (!o.excluded?.flag && checkGr1(o.opportunityName).flagged) {
        list.push({ kind: 'GR-1', text: `「${o.opportunityName}」疑似方法/目標`, path: 'longlist', owner: memberName(o.ownerUid) });
      }
      if (o.staleUpstream) {
        list.push({ kind: '上游修正', text: `「${o.opportunityName}」第三堂已更新，待套用/保留`, path: 'longlist', owner: memberName(o.ownerUid) });
      }
    }
    const cov = assumptionCoverage(plays, assumptions, { years });
    for (const cell of cov.unlinked.slice(0, 8)) {
      list.push({ kind: 'GR-5', text: `「${cell.playName}」${cell.path} 第${cell.yearIndex + 1}年 未掛假設`, path: `plays/${cell.playId}/bizplan`, owner: '' });
    }
    for (const c of comments.filter((x) => !x.resolved).slice(0, 10)) {
      list.push({ kind: '評論', text: `${c.targetLabel ? `[${c.targetLabel}] ` : ''}${c.text.slice(0, 40)}`, path: null, owner: c.authorName, comment: true });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities, plays, assumptions, comments, years, project?.members]);

  // 稽核軌跡（輕量時間軸：AI 採納/交付/評論）
  const timeline = useMemo(() => {
    const items = [
      ...aiLogs.map((l) => ({
        at: l.createdAt,
        text: `AI ${l.mode}（${l.model}）產出 ${l.count} 則假說${l.adopted ? `，採納 ${l.adopted}${l.adoptedWithoutEdit ? '（含未編輯採納⚠）' : ''}` : ''}`,
        tone: l.adoptedWithoutEdit ? 'warn' : 'idle',
      })),
      ...handoffs.map((h) => ({ at: h.frozenAt, text: `交付快照 v${h.version} 凍結（${h.plays?.length || 0} 個方案）`, tone: 'ok' })),
      ...comments.slice(0, 15).map((c) => ({ at: c.createdAt, text: `${c.authorName} 評論：${c.text.slice(0, 32)}`, tone: 'idle' })),
    ];
    return items.filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 25);
  }, [aiLogs, handoffs, comments]);

  const stepStatus = {
    step1: opportunities.length > 0,
    step2: opportunities.some((o) => o.shortlist?.included),
    step3: plays.length >= 1,
    step4: checkRun.results.find((r) => r.code === 'CHK-3')?.lamp === 'pass',
    step5: checkRun.results.find((r) => r.code === 'CHK-1')?.lamp === 'pass'
      && checkRun.results.find((r) => r.code === 'CHK-4')?.lamp === 'pass',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">協作與進度看板</h2>
          <p className="text-xs text-slate-500">誰卡在哪一步、還差多少。成熟度標示呼應鐵則 8：先做出 50 分版本，再迭代到 70／90。</p>
        </div>
        <Btn onClick={() => openComments()}>開評論抽屜</Btn>
      </div>

      {/* 區 1 進度看板：步驟 × 狀態 × 成熟度 */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STEPS.map((s) => (
          <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <button type="button" onClick={() => navigate(s.path)} className="mb-1 flex w-full items-center justify-between text-left">
              <span className="text-[13px] font-semibold text-slate-800">{s.label}</span>
              <span className={`h-2 w-2 rounded-full ${stepStatus[s.key] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>
            <div className="flex gap-1">
              {MATURITY.map((pct) => (
                <button key={pct} type="button" disabled={!ctx.editable}
                  onClick={() => setMaturity(s.key, maturity[s.key] === pct ? null : pct)}
                  className={`flex-1 rounded py-1 text-[11px] font-semibold transition ${
                    maturity[s.key] === pct
                      ? pct >= 90 ? 'bg-emerald-600 text-white' : pct >= 70 ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } disabled:cursor-not-allowed`}>
                  {pct}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 區 2 待辦與複議清單 */}
        <Section title={`待辦與複議（${todos.length}）`}>
          {todos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">目前沒有待處理的複議、爭議或評論。</p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {todos.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Chip tone={t.kind === '複議' ? 'fail' : t.kind === '評論' ? 'idle' : 'warn'}>{t.kind}</Chip>
                    <span className="truncate text-sm text-slate-700">{t.text}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {t.owner && <span className="text-[10px] text-slate-500">{t.owner}</span>}
                    {t.comment
                      ? <Btn kind="ghost" onClick={() => openComments()}>查看</Btn>
                      : t.path && <Btn kind="ghost" onClick={() => navigate(t.path)}>前往</Btn>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 區 3 稽核軌跡 */}
        <Section title="稽核軌跡（AI 採納／交付／評論）">
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">尚無紀錄。</p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span className="min-w-0">
                    <span className={`block text-sm leading-snug ${t.tone === 'warn' ? 'text-amber-700' : 'text-slate-700'}`}>{t.text}</span>
                    <span className="text-[10px] text-slate-500">{fmtTime(t.at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

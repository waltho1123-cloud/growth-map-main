import { useProjectStore } from '../../store/useProjectStore';
import { useDerived } from '../../hooks/useDerived';
import { navigate } from '../../lib/useHashRoute';
import { fmtAmount } from '../../lib/format';
import { playCountStatus } from '../../domain/guards';
import { Section, EmptyState, Lamp, Chip } from '../common/ui';

// P-01 評估工作台首頁：差距儀表＋五步驟卡＋方案概覽＋檢查燈號（唯讀彙總，無輸入）
export default function P01Dashboard() {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const rounds = useProjectStore((s) => s.rounds);
  const plays = useProjectStore((s) => s.plays);
  const { rollup, checkRun, target, settings, years } = useDerived();

  if (!project.source && opportunities.length === 0) {
    return (
      <EmptyState
        text="還沒有可評估的機會。先從第三堂把增長機會長清單帶進來吧。"
        actionLabel="前往承接長清單"
        onAction={() => navigate('longlist')}
      />
    );
  }

  const shortlisted = opportunities.filter((o) => o.shortlist?.included);
  const closedRounds = rounds.filter((r) => r.status === 'closed');
  const templatesConfirmed = plays.reduce(
    (sum, p) => sum + ['t1', 't2', 't3'].filter((k) => p.templates?.[k]?.confirmed).length, 0
  );
  const templatesTotal = plays.length * 3 + (plays.length ? 1 : 0); // 3×N＋1（彙總頁）
  const countStatus = playCountStatus(plays.length, { warnAt: settings.playWarn || 3, max: settings.playMax || 5 });

  const att = rollup.attainmentPct;
  const attTone = att == null ? 'text-slate-500' : att >= 100 ? 'text-emerald-700' : att >= 80 ? 'text-amber-700' : 'text-red-600';

  const steps = [
    { title: '① 承接長清單', metric: `${opportunities.length} 個機會`, path: 'longlist', done: opportunities.length > 0 },
    { title: '② 評估與排序', metric: closedRounds.length ? `已關 ${closedRounds.length} 輪／短名單 ${shortlisted.length}` : project.criteria?.approved ? '標準已核定' : '標準未核定', path: 'scoring', done: shortlisted.length > 0 },
    { title: '③ 收斂策略方案', metric: `${plays.length} / 1–3 個`, path: 'plays', done: plays.length >= 1 && countStatus.level !== 'block' },
    { title: '④ 高階商業計劃', metric: plays.length ? `模板 ${templatesConfirmed}/${templatesTotal - (plays.length ? 1 : 0)} 張` : '—', path: 'bizplan', done: plays.length > 0 && checkRun.results.find((r) => r.code === 'CHK-3')?.lamp === 'pass' },
    { title: '⑤ 疊加與時序', metric: att == null ? '—' : `達成率 ${att}%`, path: 'rollup', done: checkRun.results.find((r) => r.code === 'CHK-1')?.lamp === 'pass' && checkRun.results.find((r) => r.code === 'CHK-4')?.lamp === 'pass' },
  ];

  return (
    <div className="space-y-4">
      {/* 區 1 成長差距儀表 */}
      <Section>
        {target ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-6">
              <Meter label="加速增長目標 Aspiration" value={target.aspiration} />
              <div className="self-center text-xl text-slate-500">−</div>
              <Meter label="自然增長 Momentum" value={target.momentum} />
              <div className="self-center text-xl text-slate-500">=</div>
              <Meter label="成長差距 Gap" value={target.growthGap} accent />
            </div>
            <div className="min-w-56 flex-1">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs text-slate-500">目前疊加效益（Y{years} 營收口徑）</span>
                <span className={`text-2xl font-bold tabular-nums ${attTone}`}>{att == null ? '—' : `${att}%`}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${att >= 100 ? 'bg-emerald-500' : att >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.max(2, att || 0))}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                疊加 {fmtAmount(rollup.total)} ／ 目標 {fmtAmount(target.aspiration)}
                {att != null && att < 100 ? `（缺口 ${fmtAmount(rollup.gapAmount)}）` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">尚未取得第二堂差距核心值——承接長清單快照時會自動帶入；也可於 P-02 重新同步。</p>
            <Chip tone="warn">未接上游</Chip>
          </div>
        )}
      </Section>

      {/* 區 2 五步驟卡片列 */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {steps.map((s2) => (
          <button key={s2.title} type="button" onClick={() => navigate(s2.path)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-slate-800">{s2.title}</div>
              <span className={`h-2 w-2 rounded-full ${s2.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{s2.metric}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 區 3 策略方案概覽 */}
        <Section title={`策略方案（${plays.length} / 1–3）`} className="lg:col-span-2"
          aside={countStatus.level !== 'ok' && countStatus.level !== 'empty' ? <Chip tone={countStatus.level === 'block' ? 'fail' : 'warn'}>{countStatus.level === 'block' ? '超過硬上限' : '建議收斂'}</Chip> : null}>
          {plays.length === 0 ? (
            <EmptyState text="還沒選出優先機會，或尚未編組。先在矩陣上圈出你要押的注。" actionLabel="前往優先排序矩陣" onAction={() => navigate('matrix')} />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {plays.map((p) => {
                const confirmed = ['t1', 't2', 't3'].filter((k) => p.templates?.[k]?.confirmed).length;
                const y3 = p.bizplan?.fin?.pnl?.revenue?.[years - 1] || 0;
                return (
                  <button key={p.id} type="button" onClick={() => navigate(`plays/${p.id}/bizplan`)}
                    className="rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300">
                    <div className="text-sm font-semibold text-slate-900">{p.name || '未命名方案'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      來源機會 {p.sourceOppIds?.length || 0} · 模板 {confirmed}/3 · Y{years} 營收 {fmtAmount(y3)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* 區 4 綜合檢查燈號 */}
        <Section title="綜合檢查" aside={<Chip tone={checkRun.canDeliver ? 'ok' : 'idle'}>{checkRun.canDeliver ? '可交付' : '未達交付'}</Chip>}>
          <div className="space-y-2">
            {checkRun.results.map((r) => (
              <button key={r.code} type="button" onClick={() => navigate(r.goto)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                <span className="mt-1"><Lamp lamp={r.lamp} /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-slate-800">{r.code} {r.title}</span>
                  <span className="block truncate text-xs text-slate-500" title={r.reason}>{r.reason}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Meter({ label, value, accent }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-indigo-700' : 'text-slate-900'}`}>{fmtAmount(value)}</div>
    </div>
  );
}

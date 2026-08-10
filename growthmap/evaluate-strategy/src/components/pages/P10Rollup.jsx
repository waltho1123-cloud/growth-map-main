import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { updateProject } from '../../lib/db';
import { computeRollup, waterfallSegments, FALLBACK_PATHS } from '../../domain/rollup';
import { logEvent } from '../../lib/events';
import { fmtAmount, yearLabels } from '../../lib/format';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal, TextArea } from '../common/ui';

// P-10 疊加效益 Waterfall：自然增長 → 各方案 → 綜效 → 疊加效益 vs 加速增長目標
export default function P10Rollup({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);
  const [metric, setMetric] = useState('revenue');
  const [yearIndex, setYearIndex] = useState((Number(project?.settings?.forecastYears) || 3) - 1);
  const [fallbackModal, setFallbackModal] = useState(null); // path key
  const [fallbackNote, setFallbackNote] = useState('');

  const settings = project?.settings || {};
  const years = Number(settings.forecastYears) || 3;
  const target = project?.targetSnapshot;

  const rollup = useMemo(() => computeRollup({
    momentum: target?.momentum || 0,
    aspiration: target?.aspiration || 0,
    plays,
    synergies: project?.synergies,
    yearIndex: Math.min(yearIndex, years - 1),
    metric,
    taxRate: Number.isFinite(Number(settings.taxRate)) ? Number(settings.taxRate) : 0.2,
  }), [target, plays, project?.synergies, yearIndex, metric, settings.taxRate, years]);

  const anyRevenue = plays.some((p) => Number(p.bizplan?.fin?.pnl?.revenue?.[years - 1]) > 0);
  if (!anyRevenue) {
    return (
      <EmptyState text="至少要有一個方案填完三年營收，才算得出疊加效益。"
        actionLabel="前往高階商業計劃" onAction={() => navigate('bizplan')} />
    );
  }

  const segments = waterfallSegments(rollup);
  const att = rollup.attainmentPct;
  const statusTone = att == null ? 'idle' : att >= 100 ? 'ok' : 'fail';

  const chooseFallback = async () => {
    await updateProject(project.id, {
      fallbackDecision: {
        path: fallbackModal,
        note: fallbackNote.trim(),
        decidedBy: ctx.user.uid,
        decidedAt: Date.now(),
      },
    });
    logEvent(project.id, 'rollup.fallback_taken', { path: fallbackModal, attainmentPct: rollup.attainmentPct }, ctx.user.uid); // EVT-12
    const dest = { longlist: 'matrix', unit3: 'longlist', unit2: 'dashboard' }[fallbackModal];
    setFallbackModal(null);
    setFallbackNote('');
    navigate(dest);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">疊加效益（Waterfall）</h2>
          <p className="text-xs text-slate-500">數字自各方案 P-09 財務表即時計算；綜效於「時序與資源」輸入（收入／成本分列，PD-06）。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {yearLabels(years).map((y, i) => (
              <button key={y} type="button" onClick={() => setYearIndex(i)}
                className={`px-3 py-1 text-xs ${yearIndex === i ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{y}</button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[['revenue', '營收'], ['profit', '利潤']].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setMetric(v)}
                className={`px-3 py-1 text-xs ${metric === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 區 1 Waterfall 主圖 */}
      <Section>
        <Waterfall segments={segments} aspiration={rollup.aspiration} />
      </Section>

      {/* 區 2 判定條 */}
      <div className={`rounded-xl border px-4 py-3 ${
        statusTone === 'ok' ? 'border-emerald-200 bg-emerald-50' : statusTone === 'fail' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-2xl font-bold tabular-nums text-slate-900">
            達成率 {att == null ? '—' : `${att}%`}
            <span className="ml-3 text-sm font-normal text-slate-600">
              {att != null && (rollup.gapAmount > 0
                ? `缺口 ${fmtAmount(rollup.gapAmount)}`
                : `超額 ${fmtAmount(-rollup.gapAmount)}`)}
            </span>
          </div>
          {att != null && att >= 100 && !rollup.overshoot && (
            <Btn kind="primary" onClick={() => navigate('sequencing')}>可進入時序規劃 →</Btn>
          )}
        </div>
        {rollup.overshoot && (
          <p className="mt-1 text-sm text-amber-700">
            疊加效益顯著超過目標（&gt;120%）——建議回頭檢視當初的加速增長目標是否訂得過低。
          </p>
        )}
        {project.fallbackDecision && (
          <p className="mt-1 text-xs text-slate-500">
            已選回頭路徑：{FALLBACK_PATHS.find((f) => f.key === project.fallbackDecision.path)?.label}
            {project.fallbackDecision.note ? `（${project.fallbackDecision.note}）` : ''}
          </p>
        )}
      </div>

      {/* 區 3 明細表 */}
      <Section title="明細">
        <table className="w-full text-sm">
          <tbody>
            <Row label="自然增長情境（Momentum）" value={rollup.momentum} />
            {rollup.playBars.map((b) => <Row key={b.id} label={b.name} value={b.value} pct={rollup.total ? b.value / rollup.total : 0} />)}
            <Row label={`綜效（收入 ${fmtAmount(rollup.synergyRevenue)}${metric === 'profit' ? `＋成本 ${fmtAmount(rollup.synergyCost)}` : ''}）`} value={rollup.synergyValue} />
            <Row label="疊加效益" value={rollup.total} strong />
            <Row label="加速增長目標（Aspiration）" value={rollup.aspiration} strong />
          </tbody>
        </table>
      </Section>

      {/* 區 4 行動卡（未達標的三條回頭路徑，鐵則 7：不硬湊數字） */}
      {att != null && att < 100 && (
        <div className="grid gap-3 md:grid-cols-3">
          {FALLBACK_PATHS.map((f) => (
            <button key={f.key} type="button" disabled={!ctx.editable}
              onClick={() => { setFallbackModal(f.key); setFallbackNote(''); }}
              className="rounded-xl border border-red-200 bg-white p-4 text-left shadow-sm transition hover:border-red-400 disabled:opacity-60">
              <div className="text-sm font-semibold text-red-700">{f.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">{f.detail}</div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!fallbackModal} title={`回頭路徑：${FALLBACK_PATHS.find((f) => f.key === fallbackModal)?.label || ''}`} onClose={() => setFallbackModal(null)}>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          {fallbackModal === 'unit2'
            ? '重檢第二堂加速增長目標需要事業單位負責人簽核（CFM-04）；請說明複檢理由，決定會記錄在專案上。'
            : '這個決定會記錄在專案上（P-10 DoD：未達標時已選定回頭路徑）。'}
        </p>
        <TextArea rows={3} value={fallbackNote} onCommit={setFallbackNote} placeholder="理由／備註…" />
        <div className="mt-3 flex justify-end gap-2">
          <Btn onClick={() => setFallbackModal(null)}>取消</Btn>
          <Btn kind="primary" disabled={fallbackModal === 'unit2' && ctx.role !== 'owner'} onClick={chooseFallback}>
            {fallbackModal === 'unit2' && ctx.role !== 'owner' ? '需負責人（owner）執行' : '確認並前往'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong, pct }) {
  return (
    <tr className={`border-b border-slate-100 ${strong ? 'bg-slate-50 font-semibold' : ''}`}>
      <td className="py-1.5 pr-2 text-slate-700">{label}</td>
      <td className="w-32 py-1.5 pr-2 text-right tabular-nums text-slate-900">{fmtAmount(value)}</td>
      <td className="w-16 py-1.5 text-right text-xs tabular-nums text-slate-400">{pct != null ? `${Math.round(pct * 100)}%` : ''}</td>
    </tr>
  );
}

// Waterfall SVG：起始柱＋增量柱＋總計柱＋目標虛線
function Waterfall({ segments, aspiration }) {
  const W = 860;
  const H = 320;
  const PAD_L = 56;
  const PAD_B = 58;
  const maxV = Math.max(aspiration || 0, ...segments.map((s) => Math.max(s.from, s.to)), 1);
  const scaleY = (v) => H - PAD_B - (v / maxV) * (H - PAD_B - 24);
  const bw = Math.min(96, (W - PAD_L - 20) / segments.length - 14);
  const colors = { base: '#64748b', play: '#4f46e5', synergy: '#0d9488', total: '#0f172a' };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[700px] w-full">
        {/* 目標線 */}
        {aspiration > 0 && (
          <g>
            <line x1={PAD_L - 8} y1={scaleY(aspiration)} x2={W - 8} y2={scaleY(aspiration)} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="7 5" />
            <text x={W - 10} y={scaleY(aspiration) - 5} textAnchor="end" className="fill-red-600 text-[11px] font-semibold">
              加速增長目標 {fmtAmount(aspiration)}
            </text>
          </g>
        )}
        {/* 基線 */}
        <line x1={PAD_L - 8} y1={H - PAD_B} x2={W - 8} y2={H - PAD_B} stroke="#cbd5e1" />
        {segments.map((s, i) => {
          const x = PAD_L + i * ((W - PAD_L - 20) / segments.length) + 6;
          const y1 = scaleY(Math.max(s.from, s.to));
          const h = Math.max(2, Math.abs(scaleY(s.from) - scaleY(s.to)));
          const negative = s.value < 0;
          return (
            <g key={i}>
              {/* 連接線 */}
              {i > 0 && s.kind !== 'total' && (
                <line x1={x - ((W - PAD_L - 20) / segments.length) + bw + 6} y1={scaleY(s.from)} x2={x} y2={scaleY(s.from)} stroke="#e2e8f0" />
              )}
              <rect x={x} y={y1} width={bw} height={h} rx="4"
                fill={negative ? '#dc2626' : colors[s.kind]} fillOpacity={s.kind === 'play' ? 0.85 : 1} />
              <text x={x + bw / 2} y={y1 - 5} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold tabular-nums">
                {fmtAmount(s.value)}
              </text>
              <text x={x + bw / 2} y={H - PAD_B + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {s.label.length > 8 ? `${s.label.slice(0, 8)}…` : s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

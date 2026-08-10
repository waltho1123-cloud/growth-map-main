import { useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { updateProject, updateSubDoc } from '../../lib/db';
import { defaultDividers, quadrantOf } from '../../domain/matrix';
import { checkGr3 } from '../../domain/guards';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal, TextArea } from '../common/ui';

// P-05 優先排序矩陣與短名單：相對判讀、可拖曳象限線（PD-02）、GR-3、短名單決策
const PAD = 46;
const W = 560;
const H = 440;

export default function P05Matrix({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const [hoverId, setHoverId] = useState(null);
  const [sizeBy, setSizeBy] = useState('tam'); // tam | estRevenue
  const [excludeTarget, setExcludeTarget] = useState(null);
  const [excludeReason, setExcludeReason] = useState('');
  const svgRef = useRef(null);
  const [dragAxis, setDragAxis] = useState(null);
  const [dragDividers, setDragDividers] = useState(null);

  const scored = opportunities.filter((o) => o.lastAggregate?.axes && !o.excluded?.flag);
  const excluded = opportunities.filter((o) => o.excluded?.flag);
  const points = scored.map((o) => ({ ...o.lastAggregate.axes, id: o.id }));

  const dividers = dragDividers
    || project?.matrixDividers
    || defaultDividers(points);

  const shortlist = opportunities.filter((o) => o.shortlist?.included);

  const scaleX = (v) => PAD + ((Math.min(5, Math.max(0.5, v)) - 0.5) / 4.5) * (W - PAD - 16);
  const scaleY = (v) => H - PAD - ((Math.min(5, Math.max(0.5, v)) - 0.5) / 4.5) * (H - PAD - 16);
  const unscaleX = (px) => 0.5 + ((px - PAD) / (W - PAD - 16)) * 4.5;
  const unscaleY = (py) => 0.5 + ((H - PAD - py) / (H - PAD - 16)) * 4.5;

  const radiusOf = (o) => {
    const v = sizeBy === 'tam' ? (o.tam || 0) : (o.estRevenue || 0);
    const max = Math.max(1, ...scored.map((x) => (sizeBy === 'tam' ? x.tam : x.estRevenue) || 0));
    return 10 + Math.sqrt(v / max) * 18;
  };

  const sorted = [...scored].sort((a, b) => (b.lastAggregate?.total || 0) - (a.lastAggregate?.total || 0));

  if (scored.length === 0) {
    return (
      <EmptyState text="還沒有分數可以畫矩陣。等第一輪評分關閉後，落點就會出現。"
        actionLabel="前往評分工作區" onAction={() => navigate('scoring')} />
    );
  }

  const svgPoint = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerMove = (e) => {
    if (!dragAxis) return;
    const p = svgPoint(e);
    const next = { ...dividers };
    if (dragAxis === 'x') next.x = Math.min(5, Math.max(0.5, unscaleX(p.x)));
    if (dragAxis === 'y') next.y = Math.min(5, Math.max(0.5, unscaleY(p.y)));
    setDragDividers(next);
  };

  const onPointerUp = () => {
    if (dragAxis && dragDividers && ctx.editable) {
      updateProject(project.id, { matrixDividers: { x: Math.round(dragDividers.x * 10) / 10, y: Math.round(dragDividers.y * 10) / 10 } });
    }
    setDragAxis(null);
    setDragDividers(null);
  };

  const toggleShortlist = async (o) => {
    if (!ctx.editable) return;
    if (o.shortlist?.included) {
      await updateSubDoc(project.id, 'opportunities', o.id, {
        shortlist: { included: false, reason: '', decidedBy: ctx.user.uid, decidedAt: Date.now() },
        status: 'scored',
      });
      return;
    }
    if (checkGr3(o.opportunityName).flagged) return; // GR-3：無效名稱不得入短名單
    await updateSubDoc(project.id, 'opportunities', o.id, {
      shortlist: { included: true, reason: '', decidedBy: ctx.user.uid, decidedAt: Date.now() },
      excluded: { flag: false, reason: '', decidedBy: null, decidedAt: null },
      status: 'shortlisted',
    });
  };

  const confirmExclude = async () => {
    if (!excludeReason.trim()) return; // CFM-01 必填理由
    await updateSubDoc(project.id, 'opportunities', excludeTarget.id, {
      excluded: { flag: true, reason: excludeReason.trim(), decidedBy: ctx.user.uid, decidedAt: Date.now() },
      shortlist: { included: false, reason: '', decidedBy: ctx.user.uid, decidedAt: Date.now() },
    });
    setExcludeTarget(null);
    setExcludeReason('');
  };

  const qColor = { must: '#059669', quickwin: '#4f46e5', bigbet: '#d97706', skip: '#94a3b8' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">優先排序矩陣與短名單</h2>
          <p className="text-xs text-slate-500">
            這是<b>相對判讀</b>，不是機械切線（PD-02：分隔線預設取資料中位數，可拖曳）。泡泡必須顯示機會點名稱（GR-3）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">泡泡大小＝</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[['tam', 'TAM'], ['estRevenue', '預估營收']].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setSizeBy(v)}
                className={`px-3 py-1 text-xs ${sizeBy === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {ctx.editable && project?.matrixDividers && (
            <Btn kind="ghost" onClick={() => updateProject(project.id, { matrixDividers: null })}>重設分隔線</Btn>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* 區 1 矩陣畫布 */}
        <Section className="xl:col-span-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* 象限背景標籤 */}
            <text x={scaleX(dividers.x) + 10} y={22} className="fill-emerald-600 text-[11px] font-semibold">最高優先事項｜必做</text>
            <text x={PAD + 4} y={22} className="fill-amber-600 text-[11px] font-semibold">大膽投注（高風險）</text>
            <text x={scaleX(dividers.x) + 10} y={H - PAD + 16} className="fill-indigo-600 text-[11px] font-semibold">潛在速贏｜可選</text>
            <text x={PAD + 4} y={H - PAD + 16} className="fill-slate-400 text-[11px] font-semibold">低優先事項｜不做</text>

            {/* 軸 */}
            <line x1={PAD} y1={H - PAD} x2={W - 10} y2={H - PAD} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={PAD} y1={H - PAD} x2={PAD} y2={10} stroke="#cbd5e1" strokeWidth="1.5" />
            <text x={W - 12} y={H - PAD + 30} textAnchor="end" className="fill-slate-500 text-[11px]">執行難易度（③達成路徑 · ④取勝之道）→ 易</text>
            <text x={14} y={16} className="fill-slate-500 text-[11px]" transform={`rotate(-90 14 16)`} textAnchor="end">機會吸引力（①市場規模&競爭 · ②操作潛力）</text>
            {[1, 2, 3, 4, 5].map((t) => (
              <g key={t}>
                <text x={scaleX(t)} y={H - PAD + 14} textAnchor="middle" className="fill-slate-400 text-[10px]">{t}</text>
                <text x={PAD - 8} y={scaleY(t) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{t}</text>
              </g>
            ))}

            {/* 可拖曳分隔線（十字） */}
            <line x1={scaleX(dividers.x)} y1={10} x2={scaleX(dividers.x)} y2={H - PAD} stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4"
              className={ctx.editable ? 'cursor-ew-resize' : ''} onPointerDown={(e) => { if (ctx.editable) { e.target.setPointerCapture?.(e.pointerId); setDragAxis('x'); } }} />
            <line x1={PAD} y1={scaleY(dividers.y)} x2={W - 10} y2={scaleY(dividers.y)} stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4"
              className={ctx.editable ? 'cursor-ns-resize' : ''} onPointerDown={(e) => { if (ctx.editable) { e.target.setPointerCapture?.(e.pointerId); setDragAxis('y'); } }} />

            {/* 泡泡 */}
            {scored.map((o) => {
              const { x, y } = o.lastAggregate.axes;
              const q = quadrantOf({ x, y }, dividers);
              const gr3 = checkGr3(o.opportunityName);
              const r = radiusOf(o);
              const inShort = o.shortlist?.included;
              const hovered = hoverId === o.id;
              return (
                <g key={o.id}
                  onMouseEnter={() => setHoverId(o.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => toggleShortlist(o)}
                  className="cursor-pointer">
                  <circle cx={scaleX(x)} cy={scaleY(y)} r={r}
                    fill={qColor[q.key]} fillOpacity={hovered ? 0.5 : 0.28}
                    stroke={inShort ? '#4338ca' : qColor[q.key]} strokeWidth={inShort ? 3 : 1.5} />
                  {gr3.flagged && (
                    <circle cx={scaleX(x) + r * 0.72} cy={scaleY(y) - r * 0.72} r={6} fill="#dc2626" />
                  )}
                  <text x={scaleX(x)} y={scaleY(y) - r - 4} textAnchor="middle"
                    className={`text-[10px] ${hovered ? 'fill-slate-900 font-semibold' : 'fill-slate-600'}`}>
                    {(o.opportunityName || '（未命名）').slice(0, 14)}{(o.opportunityName || '').length > 14 ? '…' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-[11px] text-slate-400">點擊泡泡＝納入／移出短名單（粗框＝已入短名單；紅點＝GR-3 名稱無效）</p>
        </Section>

        {/* 區 2 排序表格 */}
        <Section className="xl:col-span-2" title={`排序表（依總分）`}
          aside={<Chip tone={shortlist.length >= 1 && shortlist.length <= 3 ? 'ok' : shortlist.length > 5 ? 'fail' : 'warn'}>短名單 {shortlist.length}／1–3</Chip>}>
          <div className="max-h-[430px] space-y-1.5 overflow-y-auto pr-1">
            {sorted.map((o, i) => {
              const agg = o.lastAggregate;
              const q = quadrantOf(agg.axes, dividers);
              const gr3 = checkGr3(o.opportunityName);
              return (
                <div key={o.id}
                  onMouseEnter={() => setHoverId(o.id)} onMouseLeave={() => setHoverId(null)}
                  className={`rounded-lg border px-2.5 py-2 transition ${hoverId === o.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="mr-1 text-xs tabular-nums text-slate-400">#{i + 1}</span>
                      <span className="text-[13px] font-medium text-slate-800">{o.opportunityName || '（未命名）'}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{agg.total}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone={q.key === 'must' ? 'ok' : q.key === 'bigbet' ? 'warn' : q.key === 'quickwin' ? 'brand' : 'idle'}>{q.short}</Chip>
                    {agg.needsReview && <Chip tone="fail">需複議</Chip>}
                    {gr3.flagged && <Chip tone="fail">GR-3</Chip>}
                    <span className="text-[11px] text-slate-400">Y {agg.axes.y}｜X {agg.axes.x}</span>
                    {ctx.editable && (
                      <span className="ml-auto flex gap-1">
                        <button type="button"
                          disabled={gr3.flagged && !o.shortlist?.included}
                          onClick={() => toggleShortlist(o)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${o.shortlist?.included ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:cursor-not-allowed disabled:opacity-40`}>
                          {o.shortlist?.included ? '移出短名單' : '納入短名單'}
                        </button>
                        <button type="button" onClick={() => { setExcludeTarget(o); setExcludeReason(''); }}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200">
                          不再列為優先
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {excluded.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <div className="mb-1 text-xs font-semibold text-slate-400">保留池（不刪除）</div>
              {excluded.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-1 text-xs text-slate-400">
                  <span className="line-through">{o.opportunityName}</span>
                  {ctx.editable && (
                    <button type="button" className="text-indigo-500 hover:underline"
                      onClick={() => updateSubDoc(project.id, 'opportunities', o.id, { excluded: { flag: false, reason: '', decidedBy: ctx.user.uid, decidedAt: Date.now() } })}>
                      撿回
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {shortlist.length > 0 && (
        <div className="flex justify-end">
          <Btn kind="primary" onClick={() => navigate('plays')}>短名單完成，前往編組策略方案 →</Btn>
        </div>
      )}

      {/* CFM-01 不再列為優先：必填理由 */}
      <Modal open={!!excludeTarget} title="標記「不再列為優先」" onClose={() => setExcludeTarget(null)}>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          「{excludeTarget?.opportunityName}」會移出短名單，但資料會保留在保留池（不刪除）。請說明不再列為優先的理由（必填）。
        </p>
        <TextArea value={excludeReason} onCommit={setExcludeReason} rows={3} placeholder="理由…" />
        <div className="mt-3 flex justify-end gap-2">
          <Btn onClick={() => setExcludeTarget(null)}>取消</Btn>
          <Btn kind="danger" disabled={!excludeReason.trim()} onClick={confirmExclude}>確認</Btn>
        </div>
      </Modal>
    </div>
  );
}

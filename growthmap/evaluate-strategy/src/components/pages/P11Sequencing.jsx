import { useProjectStore } from '../../store/useProjectStore';
import { updateProject, updateSubDoc } from '../../lib/db';
import { yearlyTotals, hardChecks } from '../../domain/sequencing';
import { fmtAmount, yearLabels } from '../../lib/format';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, NumInput, Lamp } from '../common/ui';

// P-11 時序與資源彙總：時序設定＋分年彙總表（BCG 原表）＋三項硬檢查
export default function P11Sequencing({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);

  const settings = project?.settings || {};
  const years = Number(settings.forecastYears) || 3;
  const taxRate = Number.isFinite(Number(settings.taxRate)) ? Number(settings.taxRate) : 0.2;
  const target = project?.targetSnapshot;
  const synergies = project?.synergies || { revenue: [], cost: [] };
  const yls = yearLabels(years);
  const disabled = !ctx.editable;

  // 純函式直接算（方案數 ≤5、年數 ≤5，計算便宜；免 useMemo 相依糾結）
  const table = yearlyTotals(plays, synergies, { years, taxRate });
  const checks = hardChecks({
    plays, synergies,
    momentum: target?.momentum || 0,
    aspiration: target?.aspiration || 0,
    years, taxRate,
    availableCapital: settings.availableCapital ?? null,
  });

  if (plays.length === 0) {
    return (
      <EmptyState text="還沒有策略方案可以排時序。先完成步驟三與步驟四。"
        actionLabel="前往方案編組" onAction={() => navigate('plays')} />
    );
  }

  const patchSeq = (play, patch) =>
    updateSubDoc(project.id, 'plays', play.id, { sequencing: { ...(play.sequencing || {}), ...patch } });

  // field-path 寫入單一綜效列，不整包覆寫 synergies（防並行 lost-update）
  const patchSynergy = (kind, yi, value) => {
    const arr = Array.from({ length: years }, (_, i) => Number(synergies?.[kind]?.[i]) || 0);
    arr[yi] = value;
    updateProject(project.id, { [`synergies.${kind}`]: arr });
  };

  const fteSum = plays.reduce((s, p) => s + (Number(p.bizplan?.resources?.fte) || 0), 0);
  const capexMax = Math.max(...table.totals.capex, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">時序與資源彙總</h2>
          <p className="text-xs text-slate-500">數字自各方案財務表自動帶入；僅「綜效」兩列在本頁輸入（PD-06：收入／成本分列，不得只填合計）。</p>
        </div>
        <Chip tone={checks.allPass ? 'ok' : 'fail'}>{checks.allPass ? '三項硬檢查全綠' : '尚不可交付'}</Chip>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {/* 上段 時序（每方案起訖年與相依） */}
        <Section title="執行時序與相依" className="xl:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2 font-medium">策略方案</th>
                  <th className="w-24 py-2 pr-2 font-medium">起始年</th>
                  <th className="w-24 py-2 pr-2 font-medium">結束年</th>
                  <th className="py-2 pr-2 font-medium">須待完成（相依）</th>
                  <th className="py-2 font-medium">時間軸</th>
                </tr>
              </thead>
              <tbody>
                {plays.map((p) => {
                  const seq = p.sequencing || { startYear: 1, endYear: 1, dependsOn: [] };
                  return (
                    <tr key={p.id} className="border-b border-slate-100 align-middle">
                      <td className="max-w-44 truncate py-2 pr-2 font-medium text-slate-800">{p.name || '未命名'}</td>
                      <td className="py-2 pr-2">
                        <NumInput disabled={disabled} value={seq.startYear}
                          onCommit={(v) => patchSeq(p, { startYear: Math.max(1, Math.min(years, Math.round(v) || 1)) })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumInput disabled={disabled} value={seq.endYear}
                          onCommit={(v) => patchSeq(p, { endYear: Math.max(1, Math.min(years, Math.round(v) || 1)) })} />
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap gap-1.5">
                          {plays.filter((x) => x.id !== p.id).map((x) => (
                            <label key={x.id} className="flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                              <input type="checkbox" disabled={disabled}
                                checked={(seq.dependsOn || []).includes(x.id)}
                                onChange={(e) => patchSeq(p, {
                                  dependsOn: e.target.checked
                                    ? [...(seq.dependsOn || []), x.id]
                                    : (seq.dependsOn || []).filter((d) => d !== x.id),
                                })} />
                              {x.name || '未命名'}
                            </label>
                          ))}
                          {plays.length === 1 && <span className="text-[11px] text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="py-2">
                        <GanttBar startYear={seq.startYear} endYear={seq.endYear} years={years} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 右側 三項硬檢查 */}
        <Section title="三項硬檢查（CHK-4）">
          <div className="space-y-3">
            {[checks.dependency, checks.attainment, checks.cashflow].map((c) => (
              <div key={c.key} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center gap-2">
                  <Lamp lamp={c.pass ? 'pass' : 'fail'} />
                  <span className="text-[13px] font-medium text-slate-800">{c.label}</span>
                </div>
                {c.reasons.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4 text-xs text-red-600">
                    {c.reasons.map((r, i) => <li key={i} className="list-disc">{r}</li>)}
                  </ul>
                )}
              </div>
            ))}
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500">
              資源對比：FTE 合計 {fteSum || '—'}／上限 {settings.availableFte ?? '未設'}；
              年最大 CAPEX {fmtAmount(capexMax)}／可用資金 {settings.availableCapital != null ? fmtAmount(settings.availableCapital) : '未設（到設定頁填）'}
            </div>
          </div>
        </Section>
      </div>

      {/* 下段 分年彙總表（BCG 原表結構） */}
      <Section title={`分年彙總表（${settings.currency || 'TWD'} ${settings.unit || 'M'}）`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-medium">項目</th>
                {yls.map((y) => <th key={y} className="w-28 py-2 pr-2 text-right font-medium">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <RowGroup key={r.playId} label={r.playName} rows={[
                  ['收入', r.revenue], ['成本', r.cost], ['利潤（EBIT）', r.profit], ['資本支出', r.capex],
                ]} years={years} />
              ))}
              {/* 綜效（本頁唯一輸入） */}
              <tr className="border-b border-slate-100 bg-teal-50/50">
                <td className="py-1.5 pr-2 font-medium text-teal-800">綜效 — 收入綜效</td>
                {Array.from({ length: years }, (_, yi) => (
                  <td key={yi} className="py-1 pr-2">
                    <NumInput disabled={disabled} value={synergies?.revenue?.[yi] ?? 0} onCommit={(v) => patchSynergy('revenue', yi, v)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-teal-50/50">
                <td className="py-1.5 pr-2 font-medium text-teal-800">綜效 — 成本綜效（省下的成本，正值）</td>
                {Array.from({ length: years }, (_, yi) => (
                  <td key={yi} className="py-1 pr-2">
                    <NumInput disabled={disabled} value={synergies?.cost?.[yi] ?? 0} onCommit={(v) => patchSynergy('cost', yi, v)} />
                  </td>
                ))}
              </tr>
              <RowGroup label="總計" strong rows={[
                ['總收入', table.totals.revenue], ['總成本', table.totals.cost], ['總利潤', table.totals.profit], ['總資本支出', table.totals.capex],
              ]} years={years} />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          綜效受益對象備註：<input
            className="ml-1 w-72 rounded border border-slate-200 px-2 py-0.5 text-xs"
            disabled={disabled}
            defaultValue={synergies?.beneficiary || ''}
            onBlur={(e) => updateProject(project.id, { 'synergies.beneficiary': e.target.value })}
            placeholder="這些綜效掛在既有事業／哪個方案？（防重複計算）"
          />
        </p>
      </Section>

      {checks.allPass && (
        <div className="flex justify-end">
          <Btn kind="primary" onClick={() => navigate('consensus')}>時序完成，前往定位衝擊與共識 →</Btn>
        </div>
      )}
    </div>
  );
}

function RowGroup({ label, rows, years, strong }) {
  return (
    <>
      <tr className={strong ? 'bg-slate-100' : 'bg-slate-50/60'}>
        <td colSpan={years + 1} className={`py-1.5 pr-2 text-[13px] ${strong ? 'font-bold' : 'font-semibold'} text-slate-800`}>{label}</td>
      </tr>
      {rows.map(([name, arr]) => (
        <tr key={name} className="border-b border-slate-100">
          <td className="py-1 pl-4 pr-2 text-[13px] text-slate-600">{name}</td>
          {Array.from({ length: years }, (_, yi) => (
            <td key={yi} className={`py-1 pr-2 text-right tabular-nums ${strong ? 'font-semibold' : ''} ${arr[yi] < 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {fmtAmount(arr[yi])}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function GanttBar({ startYear, endYear, years }) {
  const s = Math.max(1, Math.min(years, startYear || 1));
  const e = Math.max(s, Math.min(years, endYear || s));
  return (
    <div className="flex h-4 w-full min-w-28 overflow-hidden rounded bg-slate-100">
      {Array.from({ length: years }, (_, i) => {
        const active = i + 1 >= s && i + 1 <= e;
        return <div key={i} className={`h-full flex-1 border-r border-white ${active ? 'bg-indigo-500' : ''}`} />;
      })}
    </div>
  );
}

import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { addSubDoc, updateSubDoc } from '../../lib/db';
import { derivePnl, deriveCf, deriveBs, crossChecks, finCellRef } from '../../domain/finance';
import { createAssumptionDoc, approxJsonBytes, FIRESTORE_DOC_SOFT_LIMIT } from '../../domain/model';
import { fmtAmount, yearLabels } from '../../lib/format';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal, TextInput, TextArea, NumInput, ListEditor } from '../common/ui';

// P-09 高階商業計劃：財務三表（Y1–Yn）＋假設掛載（GR-5）＋風險/KSF/可行性四問
export default function P09Bizplan({ ctx, playId }) {
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);
  const assumptions = useProjectStore((s) => s.assumptions);
  const openAssumptions = useUiStore((s) => s.openAssumptions);
  const [tab, setTab] = useState('fin');
  const [estimator, setEstimator] = useState(null); // { path, yearIndex, label }

  const play = plays.find((p) => p.id === playId);
  const settings = project?.settings || {};
  const years = Number(settings.forecastYears) || 3;
  const taxRate = Number.isFinite(Number(settings.taxRate)) ? Number(settings.taxRate) : 0.2;

  // 衍生列每次 render 直接算（表格小、純函式便宜；useMemo 反而卡 React Compiler）
  const fin = play?.bizplan?.fin;
  const pnlRows = fin ? derivePnl(fin, { taxRate }) : null;
  const cfRows = fin ? deriveCf(fin) : null;
  const bsRows = fin ? deriveBs(fin, pnlRows) : null;
  const warnings = fin ? crossChecks(fin, { taxRate }) : [];

  if (!play) {
    return <div className="text-sm text-slate-500">找不到方案。<button className="text-indigo-600 underline" onClick={() => navigate('plays')}>回編組頁</button></div>;
  }

  const templatesConfirmed = ['t1', 't2', 't3'].every((k) => play.templates?.[k]?.confirmed);
  if (!templatesConfirmed) {
    return (
      <EmptyState text={`先把「${play.name || '此方案'}」的三張模板重新盤點完，再來做財務。`}
        actionLabel="前往模板重整" onAction={() => navigate(`plays/${play.id}/templates`)} />
    );
  }

  const disabled = !ctx.editable;
  const yls = yearLabels(years);
  const linkedRefs = new Set(assumptions.map((a) => a?.target?.ref).filter(Boolean));

  const patchFinCell = (group, field, yi, value) => {
    const arr = [...(field ? fin[group][field] : fin[group])];
    arr[yi] = value;
    const path = field ? `bizplan.fin.${group}.${field}` : `bizplan.fin.${group}`;
    updateSubDoc(project.id, 'plays', play.id, { [path]: arr });
  };

  const patchBizplan = (path, value) => updateSubDoc(project.id, 'plays', play.id, { [`bizplan.${path}`]: value });

  // GR-5 假設點：關鍵欄位（營收/COGS/CAPEX）顯示掛載狀態
  const AssumptionDot = ({ path, yi, label }) => {
    const ref = finCellRef(play.id, path, yi);
    const linked = linkedRefs.has(ref);
    const [group, field] = path.split('.');
    const value = field ? fin?.[group]?.[field]?.[yi] : fin?.[group]?.[yi];
    if (!value) return null;
    return (
      <button type="button" title={linked ? '已掛假設（點擊檢視）' : '未掛假設——填不出精確值沒關係，但要寫下你是怎麼推的（GR-5）'}
        onClick={() => openAssumptions(ref, `${play.name}｜${label}（${yls[yi]}）`)}
        className={`ml-1 inline-block h-2 w-2 rounded-full align-middle ${linked ? 'bg-blue-500' : 'bg-amber-400'}`} />
    );
  };

  const finRow = ({ label, derived, key, tone, isKey }) => (
    <tr key={label} className={`border-b border-slate-100 ${tone === 'strong' ? 'bg-slate-50 font-semibold' : ''}`}>
      <td className="py-1.5 pr-2 text-[13px] text-slate-700">{label}</td>
      {Array.from({ length: years }, (_, yi) => (
        <td key={yi} className="w-28 py-1 pr-2">
          {derived ? (
            <div className={`px-2 text-right text-sm tabular-nums ${derived[yi] < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmtAmount(derived[yi])}</div>
          ) : (
            <div className="flex items-center">
              <NumInput disabled={disabled}
                value={key.field ? fin[key.group][key.field][yi] : fin[key.group][yi]}
                onCommit={(v) => patchFinCell(key.group, key.field, yi, v)} />
              {isKey && <AssumptionDot path={key.field ? `${key.group}.${key.field}` : key.group} yi={yi} label={label} />}
            </div>
          )}
        </td>
      ))}
      <td className="py-1 text-right">
        {isKey && !disabled && (
          <button type="button" className="text-[11px] text-indigo-500 hover:underline"
            onClick={() => setEstimator({ path: key.field ? `${key.group}.${key.field}` : key.group, label })}>
            估算
          </button>
        )}
      </td>
    </tr>
  );

  const feasibility = play.bizplan?.feasibility || {};
  const risks = play.bizplan?.risks || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => navigate('bizplan')}>← 回商業計劃總覽</button>
          <h2 className="text-lg font-bold text-slate-900">高階商業計劃 · {play.name}</h2>
          <p className="text-xs text-slate-500">
            單位：{settings.currency || 'TWD'} {settings.unit || 'M'}（單表不混用）。沒有假設，就沒有數字（鐵則 5）——關鍵欄位請掛假設。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn kind="ghost" onClick={() => navigate(`plays/${play.id}/templates`)}>← 三模板</Btn>
          <Btn kind="ghost" onClick={() => openAssumptions(null, '')}>假設庫</Btn>
        </div>
      </div>

      <div className="flex gap-1">
        {[['fin', '① 財務預測'], ['risks', '② 風險與取捨'], ['ksf', '③ 能力與 KSF'], ['feasibility', '④ 可行性檢查']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${tab === k ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-200/60 text-slate-500 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {approxJsonBytes(play) > FIRESTORE_DOC_SOFT_LIMIT * 0.7 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這個方案文件已達 {(approxJsonBytes(play) / 1024).toFixed(0)} KB（Firestore 單文件上限 1024 KB）——模板與風險描述請避免貼入大段長文。
        </div>
      )}

      {tab === 'fin' && (
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {warnings.map((w) => <div key={`${w.code}-${w.year}`}>{w.message}</div>)}
            </div>
          )}
          <Section title="損益表">
            <FinTable years={yls}>
              {finRow({ label: '營業收入 Revenue', key: { group: 'pnl', field: 'revenue' }, isKey: true })}
              {finRow({ label: '營業成本 COGS', key: { group: 'pnl', field: 'cogs' }, isKey: true })}
              {finRow({ label: '營業毛利 Gross Profit', derived: pnlRows.grossProfit, tone: 'strong' })}
              {finRow({ label: '毛利率 %', derived: pnlRows.grossMarginPct })}
              {finRow({ label: '營業費用 OPEX', key: { group: 'pnl', field: 'opex' } })}
              {finRow({ label: '營業利益 EBIT', derived: pnlRows.ebit, tone: 'strong' })}
              {finRow({ label: '利息費用', key: { group: 'pnl', field: 'interest' } })}
              {finRow({ label: `所得稅（${Math.round(taxRate * 100)}%）`, derived: pnlRows.tax })}
              {finRow({ label: '本期淨利 Net Income', derived: pnlRows.netIncome, tone: 'strong' })}
              {finRow({ label: '淨利率 %', derived: pnlRows.netMarginPct })}
            </FinTable>
            {!(Number(fin?.pnl?.revenue?.[years - 1]) > 0) && (
              <p className="mt-2 text-xs text-red-600">Y{years} 營業收入為 0 或空——疊加效益（P-10）需要它，CHK-3 會擋交付。</p>
            )}
          </Section>

          <Section title="資本支出 CAPEX">
            <FinTable years={yls}>
              {finRow({ label: '資本支出 CAPEX', key: { group: 'capex', field: null }, isKey: true })}
            </FinTable>
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="資產負債表（結構化輸入＋自動總計）">
              <FinTable years={yls}>
                {finRow({ label: '現金', key: { group: 'bs', field: 'cash' } })}
                {finRow({ label: '應收帳款', key: { group: 'bs', field: 'ar' } })}
                {finRow({ label: '固定資產（設備）', key: { group: 'bs', field: 'fixedAssets' } })}
                {finRow({ label: '租賃資產', key: { group: 'bs', field: 'leaseAssets' } })}
                {finRow({ label: '資產總計', derived: bsRows.totalAssets, tone: 'strong' })}
                {finRow({ label: '短期借款', key: { group: 'bs', field: 'stDebt' } })}
                {finRow({ label: '長期借款', key: { group: 'bs', field: 'ltDebt' } })}
                {finRow({ label: '應付帳款', key: { group: 'bs', field: 'ap' } })}
                {finRow({ label: '負債總計', derived: bsRows.totalLiabilities, tone: 'strong' })}
                {finRow({ label: '投入資本', key: { group: 'bs', field: 'paidInCapital' } })}
                {finRow({ label: '保留盈餘（累計淨利）', derived: bsRows.retainedEarnings })}
                {finRow({ label: '權益總計', derived: bsRows.totalEquity, tone: 'strong' })}
              </FinTable>
            </Section>

            <Section title="現金流量表">
              <FinTable years={yls}>
                {finRow({ label: '營業活動現金流 CFO', key: { group: 'cf', field: 'cfo' } })}
                {finRow({ label: '投資活動現金流 CFI', key: { group: 'cf', field: 'cfi' } })}
                {finRow({ label: '融資活動現金流 CFF', key: { group: 'cf', field: 'cff' } })}
                {finRow({ label: '本期現金增減', derived: cfRows.netChange })}
                {finRow({ label: '期末現金餘額', derived: cfRows.endingCash, tone: 'strong' })}
              </FinTable>
              <p className="mt-2 text-xs text-slate-400">期末現金為負時上方會出現紅字提示（不阻擋儲存，ERR-05）。</p>
            </Section>
          </div>

          {/* 本方案假設列 */}
          <Section title="本方案的假設" aside={<Btn kind="ghost" onClick={() => openAssumptions(null, '')}>開啟假設庫</Btn>}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {assumptions.filter((a) => (a.target?.ref || '').includes(`fin:${play.id}:`)).map((a) => (
                <button key={a.id} type="button" onClick={() => openAssumptions(a.target.ref, a.target.label)}
                  className="min-w-56 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-indigo-300">
                  <div className="truncate text-xs font-medium text-slate-700">{a.target?.label || a.target?.ref}</div>
                  <div className="line-clamp-2 text-xs text-slate-500">{a.text}</div>
                  <div className="mt-1 flex gap-1">
                    <Chip tone={a.confidence === 'high' ? 'ok' : a.confidence === 'low' ? 'warn' : 'brand'}>信心{a.confidence === 'high' ? '高' : a.confidence === 'low' ? '低' : '中'}</Chip>
                    <Chip tone={a.status === 'verified' ? 'ok' : a.status === 'refuted' ? 'fail' : 'idle'}>
                      {{ unverified: '未驗證', verifying: '驗證中', verified: '已驗證', refuted: '已推翻' }[a.status] || a.status}
                    </Chip>
                  </div>
                </button>
              ))}
              {assumptions.filter((a) => (a.target?.ref || '').includes(`fin:${play.id}:`)).length === 0 && (
                <p className="text-xs text-slate-400">尚無假設。點關鍵欄位旁的黃點，或用「估算」建立第一筆。</p>
              )}
            </div>
          </Section>
        </div>
      )}

      {tab === 'risks' && (
        <Section title="主要風險與潛在緩解方式">
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[11px] text-slate-400">風險</label>
                  <TextInput disabled={disabled} value={r.risk} onCommit={(v) => patchBizplan('risks', risks.map((x, j) => j === i ? { ...x, risk: v } : x))} />
                </div>
                {[['likelihood', '可能性'], ['impact', '影響']].map(([f, label]) => (
                  <div key={f} className="md:col-span-2">
                    <label className="mb-1 block text-[11px] text-slate-400">{label}</label>
                    <select disabled={disabled} value={r[f] || ''}
                      onChange={(e) => patchBizplan('risks', risks.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">—</option>
                      <option value="低">低</option><option value="中">中</option><option value="高">高</option>
                    </select>
                  </div>
                ))}
                <div className="md:col-span-3">
                  <label className="mb-1 block text-[11px] text-slate-400">潛在緩解方式</label>
                  <TextInput disabled={disabled} value={r.mitigation} onCommit={(v) => patchBizplan('risks', risks.map((x, j) => j === i ? { ...x, mitigation: v } : x))} />
                </div>
                <div className="flex items-end justify-end md:col-span-1">
                  {!disabled && <Btn kind="ghost" onClick={() => patchBizplan('risks', risks.filter((_, j) => j !== i))}>刪除</Btn>}
                </div>
              </div>
            ))}
            {!disabled && <Btn onClick={() => patchBizplan('risks', [...risks, { risk: '', likelihood: '', impact: '', mitigation: '' }])}>＋ 新增風險</Btn>}
          </div>
        </Section>
      )}

      {tab === 'ksf' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="資源需求">
            <label className="mb-1 block text-xs text-slate-500">全職人力（FTE）</label>
            <TextInput disabled={disabled} value={play.bizplan?.resources?.fte} onCommit={(v) => patchBizplan('resources.fte', v)} />
            <label className="mb-1 mt-3 block text-xs text-slate-500">資本</label>
            <TextInput disabled={disabled} value={play.bizplan?.resources?.capital} onCommit={(v) => patchBizplan('resources.capital', v)} />
            <label className="mb-1 mt-3 block text-xs text-slate-500">管理層精力分配</label>
            <TextInput disabled={disabled} value={play.bizplan?.resources?.mgmtAttention} onCommit={(v) => patchBizplan('resources.mgmtAttention', v)} />
          </Section>
          <Section title="關鍵成功要素 KSF（基本門檻 vs 成功關鍵，分列）">
            <label className="mb-1 block text-xs text-slate-500">基本門檻（不做就出局）</label>
            <ListEditor disabled={disabled} items={play.bizplan?.ksf?.threshold} onCommit={(v) => patchBizplan('ksf.threshold', v)} />
            <label className="mb-1 mt-3 block text-xs text-slate-500">成功關鍵（做好才會贏）</label>
            <ListEditor disabled={disabled} items={play.bizplan?.ksf?.winning} onCommit={(v) => patchBizplan('ksf.winning', v)} />
          </Section>
        </div>
      )}

      {tab === 'feasibility' && (
        <Section title="可行性四問（CHK-3 必答）">
          <div className="space-y-3">
            {[
              ['resources', '所需資源是否存在／可取得？'],
              ['regulation', '是否有重大法規限制？'],
              ['culture', '現有文化與組織是否支持？'],
              ['time', '是否具備足夠時間？'],
            ].map(([key, q]) => (
              <div key={key} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm font-medium text-slate-800">{q}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    {[['yes', '是'], ['partial', '部分'], ['no', '否']].map(([v, label]) => (
                      <label key={v} className="flex items-center gap-1 text-sm">
                        <input type="radio" name={`fz-${key}`} disabled={disabled}
                          checked={feasibility[key]?.answer === v}
                          onChange={() => patchBizplan(`feasibility.${key}`, { ...feasibility[key], answer: v })} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="min-w-64 flex-1">
                    <TextInput disabled={disabled} placeholder="說明…" value={feasibility[key]?.note}
                      onCommit={(v) => patchBizplan(`feasibility.${key}`, { ...feasibility[key], note: v })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 相對倍數估算器（FR-07-06）：參考點 × 倍數 → 估算值＋自動建立假設 */}
      <EstimatorModal
        open={!!estimator}
        onClose={() => setEstimator(null)}
        years={yls}
        onApply={async ({ yearIndex, reference, refValue, multiple }) => {
          const value = Math.round(refValue * multiple * 10) / 10;
          const [group, field] = estimator.path.split('.');
          patchFinCell(group, field || null, yearIndex, value);
          const ref = finCellRef(play.id, estimator.path, yearIndex);
          await addSubDoc(project.id, 'assumptions', createAssumptionDoc({
            text: `以「${reference}」（${fmtAmount(refValue)}）× ${multiple} 估 ${estimator.label} ${yls[yearIndex]} ≈ ${fmtAmount(value)}`,
            targetRef: ref,
            targetLabel: `${play.name}｜${estimator.label}（${yls[yearIndex]}）`,
            source: '相對倍數估算',
            confidence: 'low',
            authorUid: ctx.user.uid,
            authorName: ctx.user.displayName || ctx.user.email || '',
          }));
          setEstimator(null);
        }}
      />
    </div>
  );
}

function FinTable({ years, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1.5 pr-2 font-medium">項目</th>
            {years.map((y) => <th key={y} className="w-28 py-1.5 pr-2 text-right font-medium">{y}</th>)}
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EstimatorModal({ open, onClose, years, onApply }) {
  const [reference, setReference] = useState('');
  const [refValue, setRefValue] = useState('');
  const [multiple, setMultiple] = useState('');
  const [yearIndex, setYearIndex] = useState(0);
  const valid = reference.trim() && Number(refValue) > 0 && Number(multiple) > 0;
  return (
    <Modal open={open} title="相對倍數估算器" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        新賽道查無市場資料時，用「參考點 × 倍數」推估（方法論：設假設、記下來、再往前推）。套用後自動建立一筆假設（信心度低）。
      </p>
      <div className="space-y-2">
        <TextInput value={reference} onCommit={setReference} placeholder="參考點（例：現有事業年營收）" />
        <div className="grid grid-cols-3 gap-2">
          <NumInput value={refValue} onCommit={setRefValue} placeholder="參考值" />
          <NumInput value={multiple} onCommit={setMultiple} placeholder="倍數" />
          <select value={yearIndex} onChange={(e) => setYearIndex(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {years.map((y, i) => <option key={y} value={i}>{y}</option>)}
          </select>
        </div>
        {valid && <p className="text-sm text-slate-700">估算值＝{fmtAmount(Number(refValue) * Number(multiple))}</p>}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Btn onClick={onClose}>取消</Btn>
        <Btn kind="primary" disabled={!valid}
          onClick={() => onApply({ yearIndex, reference: reference.trim(), refValue: Number(refValue), multiple: Number(multiple) })}>
          套用並建立假設
        </Btn>
      </div>
    </Modal>
  );
}

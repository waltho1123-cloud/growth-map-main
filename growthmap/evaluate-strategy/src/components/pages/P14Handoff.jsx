import { useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDerived } from '../../hooks/useDerived';
import { setSubDoc, updateProject } from '../../lib/db';
import { buildEvalHandoffSnapshot, SANITY_QUESTIONS } from '../../domain/model';
import { yearlyTotals } from '../../domain/sequencing';
import { waterfallSegments } from '../../domain/rollup';
import { derivePnl } from '../../domain/finance';
import { captureElementToPdf } from '@growthmap/pdf';
import { fmtAmount, fmtTime, yearLabels } from '../../lib/format';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, Modal } from '../common/ui';

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// P-14 交付輸出：BCG 五步驟結構預覽 → 凍結不可變快照（handoffs 子集合）→ PDF/JSON
export default function P14Handoff({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const plays = useProjectStore((s) => s.plays);
  const assumptions = useProjectStore((s) => s.assumptions);
  const handoffs = useProjectStore((s) => s.handoffs);
  const { checkRun, rollup, years, taxRate, synergies } = useDerived();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const totalsTable = useMemo(() => yearlyTotals(plays, synergies, { years, taxRate }), [plays, synergies, years, taxRate]);
  const canDeliver = checkRun.canDeliver;
  const nextVersion = (handoffs[0]?.version || 0) + 1;
  const yls = yearLabels(years);
  const shortlist = opportunities.filter((o) => o.shortlist?.included);
  const scored = opportunities.filter((o) => o.lastAggregate && !o.excluded?.flag);
  const isLead = ctx.role === 'owner';

  const freeze = async () => {
    setBusy(true);
    try {
      const snap = buildEvalHandoffSnapshot({
        project, opportunities, plays, rollup, totalsTable, checkRun,
      }, nextVersion);
      await setSubDoc(project.id, 'handoffs', String(nextVersion), snap);
      await updateProject(project.id, {
        lastHandoff: { version: nextVersion, frozenAt: snap.frozenAt },
        lastCheckRun: checkRun,
        stage: 'delivered',
      });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await captureElementToPdf(reportRef.current, {
        fileName: `評估策略_${project.name}_v${handoffs[0]?.version || '草稿'}.pdf`,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">交付輸出</h2>
          <p className="text-xs text-slate-500">
            依 BCG 五步驟模板結構輸出（PD-10：先求結構與欄位正確）。核定後凍結不可變快照，供第五堂讀取。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn onClick={exportPdf} disabled={exporting}>{exporting ? '匯出中…' : '匯出 PDF'}</Btn>
          <Btn onClick={() => downloadJson(
            `評估策略_${project.name}.json`,
            handoffs[0] || buildEvalHandoffSnapshot({ project, opportunities, plays, rollup, totalsTable, checkRun }, 0)
          )}>
            下載 JSON
          </Btn>
          {ctx.editable && (
            <Btn kind="primary" disabled={!canDeliver || !isLead} title={!isLead ? '交付需事業單位負責人（owner）核定' : ''}
              onClick={() => setConfirming(true)}>
              核定交付 v{nextVersion}
            </Btn>
          )}
        </div>
      </div>

      {!canDeliver && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          CHK-1～4 未全綠，交付停用：{checkRun.blockingFails.join('、')}。
          <button type="button" className="ml-2 underline" onClick={() => navigate('check')}>查看綜合檢查</button>
        </div>
      )}

      {handoffs.length > 0 && (
        <Section title="交付紀錄（不可變快照）">
          <div className="space-y-1.5">
            {handoffs.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">v{h.version} · {h.plays?.length || 0} 個方案 · 達成率 {h.rollup?.attainmentPct ?? '—'}%</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{fmtTime(h.frozenAt)}</span>
                  <Btn kind="ghost" onClick={() => downloadJson(`評估策略_${project.name}_v${h.version}.json`, h)}>JSON</Btn>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">交付後的修改會產生新版本，不影響已交付快照（安全規則禁止改寫）。</p>
        </Section>
      )}

      {/* 區 2 輸出內容預覽（PDF 擷取範圍） */}
      <div ref={reportRef} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <div className="border-b border-slate-200 pb-4 text-center">
          <div className="text-xs tracking-widest text-slate-400">成長藍圖 · 第四堂 評估策略 EVALUATE</div>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{project.name}</h3>
          <div className="mt-1 text-xs text-slate-500">
            {project.targetSnapshot ? `Aspiration ${fmtAmount(project.targetSnapshot.aspiration)}｜Momentum ${fmtAmount(project.targetSnapshot.momentum)}｜Gap ${fmtAmount(project.targetSnapshot.growthGap)}` : ''}
          </div>
        </div>

        {/* 步驟一 */}
        <ReportBlock title="步驟一｜新增長機會長清單（工具 × 機會）">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2">No</th><th className="py-1 pr-2">增長機會</th><th className="py-1 pr-2">來源工具</th><th className="py-1 pr-2">TAM</th><th className="py-1">狀態</th>
            </tr></thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{o.no}</td>
                  <td className="py-1 pr-2">{o.opportunityName}</td>
                  <td className="py-1 pr-2">{(o.sourceToolNames || []).join('、')}</td>
                  <td className="py-1 pr-2">{o.tam ? fmtAmount(o.tam) : '—'}</td>
                  <td className="py-1">{o.excluded?.flag ? '保留池' : o.shortlist?.included ? '短名單' : '候選'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportBlock>

        {/* 步驟二 */}
        <ReportBlock title="步驟二｜四維評估與優先排序">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2">機會點</th><th className="py-1 pr-2">①</th><th className="py-1 pr-2">②</th><th className="py-1 pr-2">③</th><th className="py-1 pr-2">④</th>
              <th className="py-1 pr-2">總分</th><th className="py-1 pr-2">吸引力 Y</th><th className="py-1 pr-2">難易度 X</th><th className="py-1">短名單</th>
            </tr></thead>
            <tbody>
              {scored.sort((a, b) => (b.lastAggregate?.total || 0) - (a.lastAggregate?.total || 0)).map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{o.opportunityName}</td>
                  {['size', 'potential', 'path', 'rightToWin'].map((k) => (
                    <td key={k} className="py-1 pr-2 tabular-nums">{o.lastAggregate?.perDim?.[k]?.mean ?? '—'}</td>
                  ))}
                  <td className="py-1 pr-2 font-semibold tabular-nums">{o.lastAggregate?.total}</td>
                  <td className="py-1 pr-2 tabular-nums">{o.lastAggregate?.axes?.y}</td>
                  <td className="py-1 pr-2 tabular-nums">{o.lastAggregate?.axes?.x}</td>
                  <td className="py-1">{o.shortlist?.included ? '✓' : o.excluded?.flag ? `✕（${o.excluded.reason}）` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportBlock>

        {/* 步驟三 */}
        <ReportBlock title="步驟三｜機會點整合／延伸為策略方案">
          {plays.map((p) => (
            <div key={p.id} className="mb-2 rounded-lg border border-slate-200 p-2 text-xs">
              <b>{p.name}</b>（{p.formation === 'merge' ? `整合：${(p.mergeCriteria || []).join('、')}` : `延伸：${p.extendTheme}`}）
              ← {(p.sourceOppIds || []).map((id) => opportunities.find((o) => o.id === id)?.opportunityName).filter(Boolean).join('＋')}
              {p.oneLiner ? <div className="mt-0.5 text-slate-500">{p.oneLiner}</div> : null}
            </div>
          ))}
        </ReportBlock>

        {/* 步驟四 */}
        <ReportBlock title="步驟四｜各策略方案高階商業計劃">
          {plays.map((p) => {
            const t2 = p.templates?.t2?.content || {};
            const t3 = p.templates?.t3?.content || {};
            const pnl = p.bizplan?.fin ? derivePnl(p.bizplan.fin, { taxRate }) : null;
            return (
              <div key={p.id} className="mb-3 border-b border-slate-100 pb-3 text-xs">
                <div className="mb-1 text-sm font-bold text-slate-800">{p.name} <span className="font-normal text-slate-400">EBIT {t3.ebitBand || '—'}｜CAGR {t3.cagrBand || '—'}</span></div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div><b>理念：</b>{t2.concept || '—'}</div>
                    <div><b>方法：</b>{t2.method || '—'}</div>
                    <div><b>USP：</b>{(t2.usp || []).join('；')}</div>
                    <div><b>成功因子：</b>{(t3.successFactors || []).join('；')}</div>
                    <div><b>核心能力：</b>{(t3.coreCapabilities || []).join('；')}</div>
                    <div><b>可行性：</b>{['resources', 'regulation', 'culture', 'time'].map((k) => ({ yes: '是', partial: '部分', no: '否' }[p.bizplan?.feasibility?.[k]?.answer] || '—')).join('／')}</div>
                  </div>
                  <table className="w-full text-[11px]">
                    <thead><tr className="border-b border-slate-200 text-left text-slate-400">
                      <th className="py-0.5 pr-1">財務</th>{yls.map((y) => <th key={y} className="py-0.5 pr-1 text-right">{y}</th>)}
                    </tr></thead>
                    <tbody>
                      {[['營收', p.bizplan?.fin?.pnl?.revenue], ['EBIT', pnl?.ebit], ['淨利', pnl?.netIncome], ['CAPEX', p.bizplan?.fin?.capex]].map(([label, arr]) => (
                        <tr key={label} className="border-b border-slate-100">
                          <td className="py-0.5 pr-1">{label}</td>
                          {Array.from({ length: years }, (_, i) => <td key={i} className="py-0.5 pr-1 text-right tabular-nums">{fmtAmount(arr?.[i])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </ReportBlock>

        {/* 步驟五 */}
        <ReportBlock title="步驟五｜疊加效益與分年時序彙總">
          <div className="mb-2 text-xs">
            {waterfallSegments(rollup).map((s) => `${s.label} ${fmtAmount(s.value)}`).join(' → ')}
            ｜目標 {fmtAmount(rollup.aspiration)}（達成率 {rollup.attainmentPct ?? '—'}%）
          </div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 pr-2">項目</th>{yls.map((y) => <th key={y} className="py-1 pr-2 text-right">{y}</th>)}
            </tr></thead>
            <tbody>
              {totalsTable.rows.map((r) => (
                <tr key={r.playId} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{r.playName}（收/成/利/資）</td>
                  {Array.from({ length: years }, (_, i) => (
                    <td key={i} className="py-1 pr-2 text-right tabular-nums">
                      {fmtAmount(r.revenue[i])}/{fmtAmount(r.cost[i])}/{fmtAmount(r.profit[i])}/{fmtAmount(r.capex[i])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2">綜效（收入/成本）</td>
                {Array.from({ length: years }, (_, i) => (
                  <td key={i} className="py-1 pr-2 text-right tabular-nums">{fmtAmount(totalsTable.synergyRevenue[i])}/{fmtAmount(totalsTable.synergyCost[i])}</td>
                ))}
              </tr>
              <tr className="font-semibold">
                <td className="py-1 pr-2">總計（收/成/利/資）</td>
                {Array.from({ length: years }, (_, i) => (
                  <td key={i} className="py-1 pr-2 text-right tabular-nums">
                    {fmtAmount(totalsTable.totals.revenue[i])}/{fmtAmount(totalsTable.totals.cost[i])}/{fmtAmount(totalsTable.totals.profit[i])}/{fmtAmount(totalsTable.totals.capex[i])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </ReportBlock>

        {/* 附錄 */}
        <ReportBlock title="附錄｜Sanity Check・WHY/WHAT/HOW・假設清單">
          <div className="grid gap-2 text-xs md:grid-cols-2">
            <div>
              {SANITY_QUESTIONS.map((q, i) => {
                const a = project.consensus?.sanity?.[i];
                return <div key={q} className="mb-0.5"><b>{i + 1}.</b> {q} — {{ positive: '正面', neutral: '中性', negative: '負面', severe: '高度負面' }[a?.impact] || '未答'}{a?.note ? `（${a.note}）` : ''}</div>;
              })}
            </div>
            <div>
              <div><b>WHY：</b>{(project.consensus?.why || []).join('；') || '—'}</div>
              <div><b>WHAT：</b>{(project.consensus?.what || []).join('；') || '—'}</div>
              <div><b>HOW：</b>{(project.consensus?.how || []).join('；') || '—'}</div>
              <div className="mt-1"><b>假設（{assumptions.length}）：</b>{assumptions.map((a) => a.text).join('；') || '—'}</div>
            </div>
          </div>
        </ReportBlock>

        <div className="pt-2 text-center text-[10px] text-slate-400">
          短名單 {shortlist.length} 個 · 策略方案 {plays.length} 個 · 投影片估算 {plays.length * 3 + 1} + 固定頁 · 產出於 {fmtTime(Date.now())}
        </div>
      </div>

      {/* CFM-05 核定交付 */}
      <Modal open={confirming} title={`核定交付第五堂（v${nextVersion}）`} onClose={() => setConfirming(false)}>
        <p className="mb-4 text-sm leading-relaxed text-slate-700">
          交付後將凍結快照（不可改寫、不可刪除）。之後的修改會產生新版本，不影響已交付內容。確定核定？
        </p>
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {plays.length} 個策略方案 · 達成率 {rollup.attainmentPct}% · CHK-1~4 全綠
        </div>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setConfirming(false)}>取消</Btn>
          <Btn kind="primary" disabled={busy} onClick={freeze}>{busy ? '凍結中…' : '確認核定交付'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

function ReportBlock({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 border-l-4 border-indigo-600 pl-2 text-sm font-bold text-slate-800">{title}</h4>
      {children}
    </div>
  );
}

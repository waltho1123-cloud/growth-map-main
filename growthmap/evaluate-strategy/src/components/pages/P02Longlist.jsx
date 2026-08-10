import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { importHandoff, listMyHandoffVersions, refreshTargetSnapshot, applyUpstreamUpdate, dismissUpstreamUpdate } from '../../lib/import';
import { addSubDoc, updateSubDoc } from '../../lib/db';
import { createManualOpportunity } from '../../domain/model';
import { checkGr1, computeOpportunityFlags, longlistCountStatus } from '../../domain/guards';
import { fmtTime } from '../../lib/format';
import { Section, Btn, Chip, GuardBadge, EmptyState, TextInput, NumInput, TextArea, Modal } from '../common/ui';

const GROWTH_TYPES = ['鞏固核心', '拓展鄰近', '探索新興'];

// P-02 長清單承接與盤點：匯入快照、GR-1 品質檢查、TAM/SAM 就地補錄、負責人指派
export default function P02Longlist({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const [filter, setFilter] = useState('all'); // all | gr1 | tam | template
  const [detailId, setDetailId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [versions, setVersions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');

  const flagsOf = (o) => o.qualityFlags || computeOpportunityFlags(o);
  const stats = useMemo(() => ({
    gr1: opportunities.filter((o) => flagsOf(o).gr1).length,
    tam: opportunities.filter((o) => flagsOf(o).tamMissing).length,
    template: opportunities.filter((o) => flagsOf(o).templateIncomplete).length,
  }), [opportunities]);

  const filtered = opportunities.filter((o) => {
    const f = flagsOf(o);
    if (filter === 'gr1') return f.gr1;
    if (filter === 'tam') return f.tamMissing;
    if (filter === 'template') return f.templateIncomplete;
    return true;
  });

  const countStatus = longlistCountStatus(opportunities.length);
  const detail = opportunities.find((o) => o.id === detailId) || null;

  const openImport = async () => {
    setImporting(true);
    setVersions(null);
    try {
      setVersions(await listMyHandoffVersions(ctx.user.uid));
    } catch (e) {
      setNotice(`讀取第三堂快照失敗：${e.message}`);
      setVersions([]);
    }
  };

  const doImport = async (version) => {
    setBusy(true);
    setNotice('');
    try {
      const r = await importHandoff(project.id, ctx.user.uid, version);
      if (!r.ok) setNotice(r.message);
      else setNotice(
        `承接完成：新增 ${r.imported} 個機會`
        + (r.staleMarked ? `；${r.staleMarked} 個既有機會偵測到上游修正（已標記，請逐列決定套用或保留）` : '')
        + (r.skipped ? `（${r.skipped} 個已存在且無上游變動）` : '')
        + (r.contractOk ? '' : '；⚠ 快照契約違約，請檢查主控台')
        + (r.hasTarget ? '' : '；⚠ 未取得第二堂差距值')
      );
      setImporting(false);
    } catch (e) {
      setNotice(`承接失敗：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // 就地編輯機會欄位（同時重算品質旗標）
  const patchOpp = (opp, patch) => {
    const next = { ...opp, ...patch };
    updateSubDoc(project.id, 'opportunities', opp.id, { ...patch, qualityFlags: computeOpportunityFlags(next) });
  };

  const addManual = async () => {
    const name = manualName.trim();
    if (!name) return;
    const doc = createManualOpportunity(name, opportunities.length);
    await addSubDoc(project.id, 'opportunities', doc);
    setManualName('');
    setManualOpen(false);
  };

  if (opportunities.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader project={project} onImport={openImport} onManual={() => setManualOpen(true)} onRefreshTarget={null} editable={ctx.editable} />
        {notice && <Notice text={notice} />}
        <EmptyState
          text="第三堂的長清單還沒承接進來。你可以直接承接交付快照；若第三堂尚未交付，也可以先手動建立長清單，之後再同步。"
          actionLabel={ctx.editable ? '承接第三堂交付快照' : undefined}
          onAction={openImport}
        />
        <ImportModal open={importing} versions={versions} busy={busy} onClose={() => setImporting(false)} onImport={doImport} />
        <ManualModal open={manualOpen} name={manualName} setName={setManualName} onClose={() => setManualOpen(false)} onAdd={addManual} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        project={project}
        onImport={openImport}
        onManual={() => setManualOpen(true)}
        onRefreshTarget={async () => {
          const r = await refreshTargetSnapshot(project.id, ctx.user.uid);
          setNotice(r.ok ? '已重新同步第二堂差距核心值。' : r.message);
        }}
        editable={ctx.editable}
      />
      {notice && <Notice text={notice} />}

      {/* 區 2 品質檢查摘要 */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`全部 ${opportunities.length}`} />
        <FilterChip active={filter === 'gr1'} onClick={() => setFilter('gr1')} label={`疑似方法／目標 ${stats.gr1}`} />
        <FilterChip active={filter === 'tam'} onClick={() => setFilter('tam')} label={`缺 TAM／SAM ${stats.tam}`} />
        <FilterChip active={filter === 'template'} onClick={() => setFilter('template')} label={`模板不完整 ${stats.template}`} />
        {countStatus.level !== 'ok' && <Chip tone="warn">{countStatus.message}</Chip>}
      </div>

      {/* 區 3 長清單表格 */}
      <Section>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-medium">No</th>
                <th className="py-2 pr-2 font-medium">增長機會（長清單）</th>
                <th className="py-2 pr-2 font-medium">來源工具</th>
                <th className="py-2 pr-2 font-medium">TAM</th>
                <th className="py-2 pr-2 font-medium">SAM</th>
                <th className="py-2 pr-2 font-medium">成長類型</th>
                <th className="py-2 pr-2 font-medium">負責人</th>
                <th className="py-2 pr-2 font-medium">品質標記</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const f = flagsOf(o);
                return (
                  <tr key={o.id} className={`border-b border-slate-100 align-top ${o.excluded?.flag ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-2 tabular-nums text-slate-500">{o.no}</td>
                    <td className="py-2 pr-2">
                      <TextInput value={o.opportunityName} disabled={!ctx.editable}
                        onCommit={(v) => patchOpp(o, { opportunityName: v })} className="min-w-64" />
                      {f.gr1 && <div className="mt-1"><GuardBadge code="GR-1" reason={f.gr1Reason || checkGr1(o.opportunityName).reason} /></div>}
                    </td>
                    <td className="max-w-40 py-2 pr-2 text-xs text-slate-500">
                      {(o.sourceToolNames || []).join('、') || (o.origin === 'manual' ? '手動建立' : '—')}
                    </td>
                    <td className="w-24 py-2 pr-2"><NumInput value={o.tam ?? ''} disabled={!ctx.editable} onCommit={(v) => patchOpp(o, { tam: v || null })} /></td>
                    <td className="w-24 py-2 pr-2"><NumInput value={o.sam ?? ''} disabled={!ctx.editable} onCommit={(v) => patchOpp(o, { sam: v || null })} /></td>
                    <td className="py-2 pr-2">
                      <select value={o.growthType || ''} disabled={!ctx.editable}
                        onChange={(e) => patchOpp(o, { growthType: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                        <option value="">—</option>
                        {GROWTH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select value={o.ownerUid || ''} disabled={!ctx.editable}
                        onChange={(e) => patchOpp(o, { ownerUid: e.target.value || null })}
                        className="max-w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                        <option value="">未指派</option>
                        {Object.entries(project.members || {}).map(([uid, m]) => (
                          <option key={uid} value={uid}>{m.displayName || m.email}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {f.tamMissing && <Chip tone="warn">缺 TAM/SAM</Chip>}
                        {f.templateIncomplete && <Chip tone="idle">模板不全</Chip>}
                        {o.excluded?.flag && <Chip tone="idle">保留池</Chip>}
                        {o.staleUpstream && (
                          <span className="inline-flex items-center gap-1">
                            <Chip tone="warn" title="第三堂已修正這個機會，與本頁目前的內容不同">上游已修正</Chip>
                            {ctx.editable && (
                              <>
                                <button type="button" className="text-[11px] text-indigo-600 hover:underline"
                                  onClick={() => applyUpstreamUpdate(project.id, o)}>套用上游</button>
                                <button type="button" className="text-[11px] text-slate-400 hover:underline"
                                  onClick={() => dismissUpstreamUpdate(project.id, o)}>保留本地</button>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <Btn kind="ghost" onClick={() => setDetailId(o.id)}>明細</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 區 4 明細抽屜（以 Modal 呈現三模板內容） */}
      <Modal open={!!detail} title={detail?.opportunityName || '機會明細'} onClose={() => setDetailId(null)} wide>
        {detail && <OpportunityDetail opp={detail} />}
      </Modal>

      <ImportModal open={importing} versions={versions} busy={busy} onClose={() => setImporting(false)} onImport={doImport} />
      <ManualModal open={manualOpen} name={manualName} setName={setManualName} onClose={() => setManualOpen(false)} onAdd={addManual} />
    </div>
  );
}

function PageHeader({ project, onImport, onManual, onRefreshTarget, editable }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold text-slate-900">長清單承接與盤點</h2>
        <p className="text-xs text-slate-500">
          {project.source
            ? `已承接第三堂快照 v${project.source.version}（凍結於 ${fmtTime(project.source.frozenAt)}）`
            : '尚未承接第三堂交付快照'}
        </p>
      </div>
      {editable && (
        <div className="flex gap-2">
          {onRefreshTarget && <Btn onClick={onRefreshTarget}>重新同步差距值</Btn>}
          <Btn onClick={onManual}>手動新增機會</Btn>
          <Btn kind="primary" onClick={onImport}>{project.source ? '重新同步快照' : '承接第三堂快照'}</Btn>
        </div>
      )}
    </div>
  );
}

function Notice({ text }) {
  return <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{text}</div>;
}

function FilterChip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}>
      {label}
    </button>
  );
}

function ImportModal({ open, versions, busy, onClose, onImport }) {
  return (
    <Modal open={open} title="承接第三堂交付快照" onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-slate-600">
        讀取「你自己帳號」在第三堂（識別機會）交付的長清單快照。重新同步只會補進新機會，不會覆寫本頁既有的補件與決策。
      </p>
      {versions === null ? (
        <div className="py-6 text-center text-sm text-slate-500">讀取中…</div>
      ) : versions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          第三堂尚未交付長清單快照。請先到「識別機會」單元完成綜合檢查並交付，或在本頁手動建立長清單。
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <button key={v.version} type="button" disabled={busy} onClick={() => onImport(v.version)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-300 disabled:opacity-50">
              <span>版本 v{v.version} · {v.opportunityCount} 個機會</span>
              <span className="text-xs text-slate-400">{fmtTime(v.frozenAt)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ManualModal({ open, name, setName, onClose, onAdd }) {
  return (
    <Modal open={open} title="手動新增機會（後援）" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        機會點要寫成「市場／賽道＋商模或策略」，不是方法或目標（GR-1）。建議 30–80 字。
      </p>
      <TextArea value={name} onCommit={setName} rows={2} placeholder="例：跨足通路端：透過入股通路商建立自有通路，以提升品牌指名度" />
      <div className="mt-3 flex justify-end gap-2">
        <Btn onClick={onClose}>取消</Btn>
        <Btn kind="primary" onClick={onAdd}>新增</Btn>
      </div>
    </Modal>
  );
}

function OpportunityDetail({ opp }) {
  const t1 = opp.template1 || {};
  const t2 = opp.template2 || {};
  const t3 = opp.template3 || {};
  const row = (label, value) => (value ? (
    <div className="mb-2">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="whitespace-pre-wrap text-sm text-slate-800">{String(value)}</div>
    </div>
  ) : null);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-indigo-700">模板一 · 工具→洞察</h4>
        {row('企業原型', t1.companyType)}
        {row('成長面向', t1.growthDimension)}
        {row('成長槓桿', t1.growthLever)}
        {row('成長類型', (t1.growthType || []).join('、'))}
        {row('主要洞察', t1.insights)}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-indigo-700">模板二 · 機會描述</h4>
        {row('增長理念', t2.concept)}
        {row('增長方法', t2.method)}
        {row('目標客戶', t2.targetCustomer)}
        {row('USP', t2.usp)}
        {row('實施步驟', t2.steps || t2.implementationSteps)}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-indigo-700">模板三 · 四象限評估</h4>
        {row('市場規模', t3.marketSize)}
        {row('現有規模', t3.currentScale)}
        {row('CAGR', t3.cagr)}
        {row('競爭環境', t3.competitiveEnvironment)}
        {row('必要投資', t3.requiredInvestment)}
        {row('成功因子', t3.successFactors)}
        {row('核心能力', t3.coreCapabilities)}
        {t3.ratings && (
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            第三堂初評：規模 {t3.ratings.size}／潛力 {t3.ratings.potential}／路徑 {t3.ratings.path}／優勢 {t3.ratings.rightToWin}
          </div>
        )}
      </div>
    </div>
  );
}

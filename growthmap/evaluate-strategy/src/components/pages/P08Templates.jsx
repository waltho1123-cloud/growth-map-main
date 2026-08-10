import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { updateSubDoc } from '../../lib/db';
import { contentFingerprint } from '../../domain/model';
import { checkGr7 } from '../../domain/guards';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, GuardBadge, TextInput, TextArea, ListEditor, Modal } from '../common/ui';

const GROWTH_LEVERS = ['擴大現有市場', '新市場・新客戶', '新產品', '新商業模式', '併購'];
const GROWTH_TYPES = ['鞏固核心', '拓展鄰近', '探索新興'];
const EBIT_BANDS = ['5–10%', '10–15%', '>15%'];
const CAGR_BANDS = ['<2%', '~2–5%', '>5%'];

// P-08 三模板重整：底稿（自來源機會彙整）→ 人工改寫 → 逐張確認（GR-6/GR-7）
export default function P08Templates({ ctx, playId }) {
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);
  const play = plays.find((p) => p.id === playId);
  const [tab, setTab] = useState('t1');
  const [gr6Confirm, setGr6Confirm] = useState(null); // 待確認的 tab key

  if (!play) {
    return <div className="text-sm text-slate-500">找不到方案。<button className="text-indigo-600 underline" onClick={() => navigate('plays')}>回編組頁</button></div>;
  }

  const tpl = play.templates?.[tab] || { content: {}, confirmed: false };
  const disabled = !ctx.editable || tpl.confirmed;
  const confirmedCount = ['t1', 't2', 't3'].filter((k) => play.templates?.[k]?.confirmed).length;
  const totalCards = plays.length * 3 + 1; // 3×N＋1
  const confirmedAll = plays.reduce((s, p) => s + ['t1', 't2', 't3'].filter((k) => p.templates?.[k]?.confirmed).length, 0);

  const patchContent = (patch) => {
    updateSubDoc(project.id, 'plays', play.id, {
      [`templates.${tab}.content`]: { ...tpl.content, ...patch },
    });
  };

  // 每個條列區塊至少 2 筆（P-08 驗證）；t1 洞察至少 1 筆
  const listRequirements = {
    t1: [['insights', '主要洞察', 1]],
    t2: [['targetCustomers', '目標客戶', 2], ['goToMarket', '市場進入策略', 2], ['usp', '獨特賣點', 2], ['steps', '實施步驟', 2]],
    t3: [['requiredInvestment', '必要投資', 2], ['potentialHurdles', '潛在障礙', 2], ['successFactors', '成功因子', 2], ['coreCapabilities', '核心能力', 2]],
  };
  const missingLists = (listRequirements[tab] || [])
    .filter(([key, , min]) => (Array.isArray(tpl.content?.[key]) ? tpl.content[key].length : 0) < min);
  const gr7Fields = tab === 't3' ? ['requiredInvestment', 'successFactors', 'coreCapabilities'] : [];
  const gr7Hits = gr7Fields.flatMap((f) => (tpl.content?.[f] || []).filter((item) => checkGr7(item).flagged));

  const tryConfirm = () => {
    if (missingLists.length > 0) return;
    const unedited = contentFingerprint(tpl.content) === tpl.draftFingerprint;
    if (unedited) {
      setGr6Confirm(tab); // GR-6：底稿未編輯 → 二次確認
      return;
    }
    doConfirm(false);
  };

  const doConfirm = async (uneditedAck) => {
    await updateSubDoc(project.id, 'plays', play.id, {
      [`templates.${tab}.confirmed`]: true,
      [`templates.${tab}.confirmedBy`]: ctx.user.uid,
      [`templates.${tab}.confirmedAt`]: Date.now(),
      [`templates.${tab}.confirmedWithoutEdit`]: !!uneditedAck, // 稽核提醒（GR-6）
    });
    setGr6Confirm(null);
  };

  const unconfirm = async () => {
    await updateSubDoc(project.id, 'plays', play.id, { [`templates.${tab}.confirmed`]: false });
  };

  const gr7Badge = (item) => {
    const r = checkGr7(item);
    return r.flagged ? <GuardBadge code="GR-7" reason={r.reason} /> : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => navigate('plays')}>← 回方案編組</button>
          <h2 className="text-lg font-bold text-slate-900">三模板重整 · {play.name || '未命名方案'}</h2>
          <p className="text-xs text-slate-500">
            左為來源底稿自動彙整（標【來源】者），請針對本方案改寫後逐張確認。全案進度：已確認 {confirmedAll}／{totalCards - 1} 張（+1 彙總頁於交付產出）。
          </p>
        </div>
        <Btn kind="ghost" onClick={() => navigate(`plays/${play.id}/bizplan`)}>前往商業計劃 →</Btn>
      </div>

      {/* 分頁籤 */}
      <div className="flex gap-1">
        {[['t1', '模板一 工具→洞察'], ['t2', '模板二 機會描述'], ['t3', '模板三 四象限評估']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${tab === k ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-200/60 text-slate-500 hover:bg-slate-200'}`}>
            {label} {play.templates?.[k]?.confirmed ? '✓' : ''}
          </button>
        ))}
      </div>

      <Section
        aside={
          <div className="flex items-center gap-2">
            {tpl.confirmed
              ? (<><Chip tone="ok">已確認</Chip>{ctx.editable && <Btn kind="ghost" onClick={unconfirm}>取消確認</Btn>}</>)
              : (<>
                  {missingLists.length > 0 && <Chip tone="warn">{missingLists.map(([, label, min]) => `${label}需 ≥${min} 筆`).join('、')}</Chip>}
                  {gr7Hits.length > 0 && <Chip tone="warn">GR-7 泛用詞 {gr7Hits.length} 筆</Chip>}
                  {ctx.editable && <Btn kind="primary" disabled={missingLists.length > 0} onClick={tryConfirm}>確認完成本模板</Btn>}
                </>)}
          </div>
        }
        title={`確認狀態 ${confirmedCount}/3`}
      >
        {tab === 't1' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">起點評估（企業原型，自第二堂帶入可覆寫）</label>
              <TextInput value={tpl.content?.companyType || ''} disabled={disabled} ariaLabel="企業原型" onCommit={(v) => patchContent({ companyType: v })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">成長面向</label>
              <TextInput value={tpl.content?.growthDimension || ''} disabled={disabled} ariaLabel="成長面向" onCommit={(v) => patchContent({ growthDimension: v })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">成長類型</label>
              <div className="flex flex-wrap gap-3 text-sm">
                {GROWTH_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={disabled}
                      checked={(tpl.content?.growthType || []).includes(t)}
                      onChange={(e) => patchContent({
                        growthType: e.target.checked
                          ? [...(tpl.content?.growthType || []), t]
                          : (tpl.content?.growthType || []).filter((x) => x !== t),
                      })} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">成長槓桿</label>
              <select value={tpl.content?.growthLever || ''} disabled={disabled} aria-label="成長槓桿"
                onChange={(e) => patchContent({ growthLever: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">—</option>
                {GROWTH_LEVERS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">使用工具（來源機會之工具聯集，唯讀追溯）</label>
              <div className="flex flex-wrap gap-1.5">
                {(tpl.content?.usedToolNames || []).map((t) => <Chip key={t} tone="idle">{t}</Chip>)}
                {(tpl.content?.usedToolNames || []).length === 0 && <span className="text-xs text-slate-500">—</span>}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">主要洞察（≥1 筆）</label>
              <ListEditor items={tpl.content?.insights} disabled={disabled} onCommit={(v) => patchContent({ insights: v })} />
            </div>
          </div>
        )}

        {tab === 't2' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">增長理念敘述</label>
              <TextArea rows={4} value={tpl.content?.concept || ''} disabled={disabled} ariaLabel="增長理念敘述" onCommit={(v) => patchContent({ concept: v })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">增長方法</label>
              <TextArea rows={4} value={tpl.content?.method || ''} disabled={disabled} ariaLabel="增長方法" onCommit={(v) => patchContent({ method: v })} />
            </div>
            {[['targetCustomers', '目標客戶'], ['goToMarket', '市場進入策略'], ['usp', '獨特賣點（USP）'], ['steps', '實施步驟（有序）']].map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-slate-500">{label}（≥2 筆）</label>
                <ListEditor items={tpl.content?.[key]} disabled={disabled} onCommit={(v) => patchContent({ [key]: v })} />
              </div>
            ))}
          </div>
        )}

        {tab === 't3' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex gap-3 md:col-span-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">EBIT 利潤率區間</label>
                <select value={tpl.content?.ebitBand || ''} disabled={disabled} aria-label="EBIT 利潤率區間"
                  onChange={(e) => patchContent({ ebitBand: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  {EBIT_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">CAGR ’30</label>
                <select value={tpl.content?.cagrBand || ''} disabled={disabled} aria-label="CAGR 區間"
                  onChange={(e) => patchContent({ cagrBand: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  {CAGR_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">1 市場規模 & 競爭：現有規模／成長潛力</label>
              <TextArea rows={3} value={tpl.content?.currentScale || ''} disabled={disabled} ariaLabel="現有規模" onCommit={(v) => patchContent({ currentScale: v })} placeholder="現有規模（單位價格或 $ 市場規模）" />
              <TextArea rows={2} className="mt-1.5" value={tpl.content?.growthPotential || ''} disabled={disabled} ariaLabel="成長潛力" onCommit={(v) => patchContent({ growthPotential: v })} placeholder="成長潛力（含年份）" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">競爭環境（飽和／集中／分散）與前 X 大市佔</label>
              <TextArea rows={3} value={tpl.content?.competitiveEnvironment || ''} disabled={disabled} ariaLabel="競爭環境" onCommit={(v) => patchContent({ competitiveEnvironment: v })} />
              <TextInput className="mt-1.5" value={tpl.content?.topBrandsShare || ''} disabled={disabled} ariaLabel="前 X 大品牌市佔率" onCommit={(v) => patchContent({ topBrandsShare: v })} placeholder="前 X 大品牌市佔率" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">2 操作潛力：綜效條列（建議依 生產／產品／跨域 分類書寫）</label>
              <ListEditor items={tpl.content?.synergies} disabled={disabled} onCommit={(v) => patchContent({ synergies: v })} />
            </div>
            {[['requiredInvestment', '3 達成路徑：必要投資'], ['potentialHurdles', '3 達成路徑：潛在障礙'], ['successFactors', '4 取勝之道：成功因子'], ['coreCapabilities', '4 取勝之道：核心能力']].map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-slate-500">{label}（≥2 筆）</label>
                <ListEditor items={tpl.content?.[key]} disabled={disabled} onCommit={(v) => patchContent({ [key]: v })} renderBadge={gr7Badge} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* GR-6 未編輯即確認 → 二次確認並記錄 */}
      <Modal open={!!gr6Confirm} title="底稿尚未改寫" onClose={() => setGr6Confirm(null)}>
        <p className="mb-4 text-sm leading-relaxed text-slate-700">
          這份底稿是從來源機會自動彙整的。合併後的方案需要重新盤點，請確認內容已針對本方案改寫。
          仍要直接確認嗎？（此動作會被記錄）
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setGr6Confirm(null)}>回去改寫</Btn>
          <Btn kind="danger" onClick={() => doConfirm(true)}>仍要確認</Btn>
        </div>
      </Modal>
    </div>
  );
}

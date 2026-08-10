import { useState } from 'react';
import { increment } from 'firebase/firestore';
import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { useDerived } from '../../hooks/useDerived';
import { addSubDoc, updateSubDoc } from '../../lib/db';
import { AI_MODES, callEvaMode } from '../../lib/ai';
import { createAssumptionDoc } from '../../domain/model';
import { Btn, Chip, TextArea, Modal } from '../common/ui';

// P-15 AI 協作抽屜：四模式（假說生成）。鐵則 6／GR-8：
// 「AI 的 output 只能當 input」——假說卡必須先進入編輯狀態才能採納；
// 未編輯直接採納者記錄於 aiLogs（adoptedWithoutEdit）。
export default function AiDrawer({ ctx }) {
  const drawer = useUiStore((s) => s.drawer);
  const close = useUiStore((s) => s.closeDrawer);
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);
  const opportunities = useProjectStore((s) => s.opportunities);
  const { target, rollup, years } = useDerived();
  const [modeKey, setModeKey] = useState('hat');
  const [fieldValue, setFieldValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState([]); // { id, title, content, edited, editing, logId, adopted }
  // CFM-06（PD-09 補全）：金額已指數化，但機會/方案「名稱」與使用者輸入無法
  // 代碼化（代碼化會讓紅隊/掃描失去分析對象）——首次送出前明示內容並取得確認，
  // 確認記入稽核；本抽屜開啟期間有效。
  const [consented, setConsented] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!drawer || drawer.type !== 'ai') return null;
  const mode = AI_MODES.find((m) => m.key === modeKey);

  // 脈絡帶入——PD-09 去識別化：金額一律轉「Momentum＝100 的指數」，不送原始數值；
  // 也不帶完整財表。方法論本來就主張市場規模用相對倍數思考。
  const buildContext = () => {
    const base = target?.momentum || target?.aspiration || 0;
    const idx = (v) => (base > 0 && Number.isFinite(Number(v)) ? Math.round((Number(v) / base) * 100) : null);
    return {
      口徑說明: '所有金額為指數（自然增長 Momentum＝100），非實際幣值',
      成長差距摘要: target
        ? `Aspiration 指數 ${idx(target.aspiration) ?? '—'}、Momentum 100、Gap 指數 ${idx(target.growthGap) ?? '—'}`
        : '未接上游',
      疊加達成率: rollup.attainmentPct != null ? `${rollup.attainmentPct}%` : '未計算',
      短名單機會: opportunities.filter((o) => o.shortlist?.included).map((o) => o.opportunityName),
      策略方案: plays.map((p) => ({
        名稱: p.name, 形成: p.formation, 一句話: p.oneLiner,
        [`Y${years}營收指數`]: idx(p.bizplan?.fin?.pnl?.revenue?.[years - 1]) ?? 0,
      })),
    };
  };

  const generate = () => {
    if (busy) return;
    if ((mode.key === 'reverse' || mode.key === 'scan') && !fieldValue.trim()) {
      setError(`請先填「${mode.inputLabel}」`);
      return;
    }
    if (!consented) {
      setConfirmOpen(true); // CFM-06：首次送出前確認
      return;
    }
    doGenerate();
  };

  const doGenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await callEvaMode(mode, fieldValue.trim(), buildContext());
      const hyps = res?.payload?.hypotheses || [];
      // 稽核（FR-10-04）：prompt 摘要/模型/信心/用量＋CFM-06 同意記錄
      const logId = await addSubDoc(project.id, 'aiLogs', {
        mode: mode.key, taskCode: mode.taskCode,
        promptSummary: (fieldValue.trim() || '(預設)').slice(0, 120),
        sentNamesConsent: true, // CFM-06：名稱類內容經確認後送出
        model: res?.model || mode.model,
        confidence: res?.confidence ?? null,
        usage: res?.usage || null,
        count: hyps.length,
        by: ctx.user.uid,
        createdAt: Date.now(),
        adopted: 0,
      });
      setCards(hyps.map((h, i) => ({
        id: `${logId}-${i}`, logId,
        title: h.title || '', content: h.content || '',
        draft: `${h.title ? `${h.title}：` : ''}${h.content || ''}`,
        editing: false, edited: false, adopted: false,
      })));
      if (hyps.length === 0) setError('AI 沒有回傳可用的假說，請調整輸入重試。');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const adopt = async (card) => {
    // GR-8：採納＝轉為一筆「AI 假說」來源的假設（未驗證），進入 P-16 驗證流
    await addSubDoc(project.id, 'assumptions', createAssumptionDoc({
      text: card.draft.trim(),
      targetRef: null,
      targetLabel: `AI ${mode.label}`,
      source: 'AI 假說',
      confidence: 'low',
      authorUid: ctx.user.uid,
      authorName: ctx.user.displayName || ctx.user.email || '',
    }));
    await updateSubDoc(project.id, 'aiLogs', card.logId, {
      adopted: increment(1), // 原子遞增——連續採納不因 stale closure 少計
      adoptedAt: Date.now(),
      adoptedWithoutEdit: !card.edited, // 未編輯即採納 → 稽核異常清單素材
    });
    setCards((cur) => cur.map((c) => (c.id === card.id ? { ...c, adopted: true, editing: false } : c)));
  };

  return (
    <div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="absolute right-0 top-0 flex h-full w-[420px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">AI 協作（四模式）</h3>
            <button type="button" onClick={close} className="text-slate-500 hover:text-slate-700">✕</button>
          </div>
          {/* 常駐警語（PRD P-15 強制文案） */}
          <p className="mt-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-violet-800">
            以下皆為<b>假說</b>。AI 的 output 只能當你的 input，責任由人承擔。
          </p>
        </div>

        <div className="border-b border-slate-100 px-4 py-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {AI_MODES.map((m) => (
              <button key={m.key} type="button"
                onClick={() => { setModeKey(m.key); setCards([]); setError(''); setFieldValue(''); }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${modeKey === m.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{mode.hint}</p>
          <div className="flex gap-2">
            <input value={fieldValue} onChange={(e) => setFieldValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
              placeholder={mode.inputLabel}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
            <Btn kind="primary" disabled={busy || !ctx.editable} onClick={generate}
              className="!bg-violet-600 hover:!bg-violet-700">
              {busy ? '生成中…' : '生成假說'}
            </Btn>
          </div>
          {!ctx.editable && <p className="mt-1 text-[11px] text-slate-500">coach 角色可檢視，不可採納（PRD §7.7）。</p>}
          {error && <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {cards.length === 0 && !busy && (
            <p className="pt-8 text-center text-xs text-slate-500">選一個模式，生成 3–5 則假說卡。</p>
          )}
          {cards.map((card) => (
            <div key={card.id} className={`rounded-xl border-l-4 p-3 ${card.adopted ? 'border-emerald-400 bg-emerald-50/50' : 'border-violet-400 bg-violet-50/40'}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-800">{card.title || '假說'}</span>
                <Chip tone={card.adopted ? 'ok' : 'warn'}>{card.adopted ? '已採納' : '假說'}</Chip>
              </div>
              {card.editing ? (
                <>
                  <TextArea rows={4} value={card.draft}
                    onCommit={(v) => setCards((cur) => cur.map((c) => (c.id === card.id ? { ...c, draft: v, edited: v !== `${card.title ? `${card.title}：` : ''}${card.content}` } : c)))} />
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <Btn kind="ghost" onClick={() => setCards((cur) => cur.map((c) => (c.id === card.id ? { ...c, editing: false } : c)))}>收合</Btn>
                    <Btn kind="primary" disabled={!ctx.editable} onClick={() => adopt(card)}
                      title={card.edited ? '' : 'AI 給的是假說。請先編輯成你自己的判斷再採納（直接採納會記入稽核）。'}>
                      採納為假設{card.edited ? '' : '（未編輯）'}
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{card.content}</p>
                  {!card.adopted && ctx.editable && (
                    <div className="mt-1.5 flex justify-end">
                      {/* GR-8：採納鈕在進入編輯狀態前不出現 */}
                      <Btn kind="ghost" onClick={() => setCards((cur) => cur.map((c) => (c.id === card.id ? { ...c, editing: true } : c)))}>
                        編輯後採納
                      </Btn>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-4 py-2 text-[10px] leading-relaxed text-slate-500">
          採納的假說會成為一筆「AI 假說」來源的假設（信心低、未驗證），請到假設庫掛驗證證據。
          每次生成的 prompt／模型／用量已寫入稽核（aiLogs）。
        </div>
      </aside>

      {/* CFM-06：送出內容明示＋二次確認（金額已指數化；名稱與輸入文字無法代碼化） */}
      <Modal open={confirmOpen} title="送出內容確認（寫入稽核）" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          <p>本次請求將送出以下內容給 AI 服務：</p>
          <ul className="list-disc pl-5 text-[13px]">
            <li>短名單機會與策略方案的<b>名稱／一句話說明</b>（原文，未代碼化）</li>
            <li>你在輸入框填的文字</li>
            <li>金額摘要——<b>已指數化</b>（Momentum＝100），不含實際幣值與完整財表</li>
          </ul>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            若機會／方案名稱含併購標的、未公開產品代號等敏感字眼，請先改寫名稱再使用 AI。
            此確認會寫入稽核（aiLogs），本次抽屜開啟期間不再重複詢問。
          </p>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Btn onClick={() => setConfirmOpen(false)}>取消</Btn>
          <Btn kind="primary" onClick={() => { setConsented(true); setConfirmOpen(false); doGenerate(); }}>
            我了解，送出
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

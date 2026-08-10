import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { setSubDoc, updateSubDoc } from '../../lib/db';
import { DIMENSIONS } from '../../domain/criteria';
import { totalOf, isComplete, axesOf, aggregateScores, rationaleRequired, scoreDocId } from '../../domain/scoring';
import { logEvent } from '../../lib/events';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal } from '../common/ui';

// P-04 機會評分工作區：我的評分（1–5 鍵盤可用）＋全體彙總與離散度複議
export default function P04Scoring({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const rounds = useProjectStore((s) => s.rounds);
  const scores = useProjectStore((s) => s.scores);
  const plays = useProjectStore((s) => s.plays);
  const [view, setView] = useState('mine'); // mine | all
  const [roundN, setRoundN] = useState(null);
  const [anchorHint, setAnchorHint] = useState(null); // {dimKey}

  const criteria = project?.criteria;
  const dispersionThreshold = Number(project?.settings?.dispersionThreshold) || 2;
  const openRound = rounds.find((r) => r.status === 'open');
  const activeRoundN = roundN ?? (openRound?.n || rounds.at(-1)?.n || null);
  const activeRound = rounds.find((r) => r.n === activeRoundN);
  const roundOpen = activeRound?.status === 'open';
  const scorable = opportunities.filter((o) => !o.excluded?.flag);

  const myScoreOf = (oppId) => scores.find((s) => s.oppId === oppId && s.round === activeRoundN && s.scorerUid === ctx.user.uid);
  const scoresOf = (oppId) => scores.filter((s) => s.oppId === oppId && s.round === activeRoundN);

  const aggregates = useMemo(() => {
    const map = {};
    for (const o of scorable) {
      map[o.id] = aggregateScores(scoresOf(o.id), { dispersionThreshold, weighting: criteria?.weighting });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, opportunities, activeRoundN, dispersionThreshold, criteria?.weighting]);

  if (!criteria?.approved && rounds.length === 0) {
    return (
      <EmptyState text="評分要先有共同標準。請先完成四維定義與量表錨點。"
        actionLabel="前往設定評估標準" onAction={() => navigate('criteria')} />
    );
  }
  if (scorable.length === 0) {
    return (
      <EmptyState text="還沒有可評分的機會。先到長清單承接第三堂交付快照。"
        actionLabel="前往承接長清單" onAction={() => navigate('longlist')} />
    );
  }

  const setDim = async (opp, dimKey, value) => {
    if (!ctx.editable || !roundOpen) return;
    const existing = myScoreOf(opp.id);
    if (existing?.submitted) return; // 提交後鎖定
    const dims = { ...(existing?.dims || {}), [dimKey]: value };
    const id = scoreDocId(opp.id, activeRoundN, ctx.user.uid);
    await setSubDoc(project.id, 'scores', id, {
      oppId: opp.id,
      round: activeRoundN,
      scorerUid: ctx.user.uid,
      scorerName: ctx.user.displayName || ctx.user.email || '',
      dims,
      rationales: existing?.rationales || {},
      submitted: false,
      updatedAt: Date.now(),
    });
  };

  const setRationale = async (opp, dimKey, text) => {
    const existing = myScoreOf(opp.id);
    if (!existing || existing.submitted) return;
    await updateSubDoc(project.id, 'scores', scoreDocId(opp.id, activeRoundN, ctx.user.uid), {
      rationales: { ...(existing.rationales || {}), [dimKey]: text },
      updatedAt: Date.now(),
    });
  };

  const submitMine = async (opp) => {
    const mine = myScoreOf(opp.id);
    if (!mine || !isComplete(mine.dims)) return;
    // 極端分數必填依據（P-04 驗證）；缺 TAM/SAM 時維度①依據必填
    const missing = DIMENSIONS.filter((d) => {
      const v = mine.dims[d.key];
      const needsByExtreme = rationaleRequired(v);
      const needsByTam = d.key === 'size' && (opp.qualityFlags?.tamMissing);
      return (needsByExtreme || needsByTam) && !(mine.rationales?.[d.key] || '').trim();
    });
    if (missing.length > 0) {
      alert(`請先填寫評分依據：${missing.map((d) => d.name).join('、')}（1／5 分或缺 TAM 的市場維度必填）`);
      return;
    }
    await updateSubDoc(project.id, 'scores', scoreDocId(opp.id, activeRoundN, ctx.user.uid), { submitted: true, updatedAt: Date.now() });
    logEvent(project.id, 'score.submitted', { // EVT-04
      oppId: opp.id, round: activeRoundN,
      hasRationales: Object.values(mine.rationales || {}).some((r) => (r || '').trim()),
    }, ctx.user.uid);
  };

  const closeRound = async () => {
    if (!activeRound) return;
    const pending = Object.values(project.members || {}).filter((m) => m.role !== 'coach').length -
      new Set(scores.filter((s) => s.round === activeRoundN && s.submitted).map((s) => s.scorerUid)).size;
    const ok = window.confirm(`關閉後本輪分數將鎖定，若要修改需開新輪次。${pending > 0 ? `目前約有 ${pending} 位評分者尚未提交。` : ''}確定關閉第 ${activeRoundN} 輪？`);
    if (!ok) return;
    await updateSubDoc(project.id, 'rounds', activeRound.id, { status: 'closed', closedAt: Date.now(), closedBy: ctx.user.uid });
    // 關輪後把彙總座標寫回機會（矩陣頁與後續步驟的資料快取）
    await Promise.all(scorable.map((o) => {
      const agg = aggregates[o.id];
      if (!agg || agg.scorerCount === 0) return null;
      return updateSubDoc(project.id, 'opportunities', o.id, {
        lastAggregate: { round: activeRoundN, total: agg.total, axes: agg.axes, perDim: agg.perDim, scorerCount: agg.scorerCount, needsReview: agg.needsReview },
        status: 'scored',
      });
    }));
  };

  const reopenNewRound = async () => {
    // 輪次文件以輪次號為 docId（rules 的 score 規則靠它查輪次狀態）
    const n = (rounds.at(-1)?.n || 0) + 1;
    await setSubDoc(project.id, 'rounds', String(n), { n, status: 'open', createdAt: Date.now(), createdBy: ctx.user.uid });
  };

  const isFacil = ctx.role === 'owner' || ctx.role === 'facilitator';

  return (
    <div className="space-y-4">
      {/* 區 1 工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">機會評分工作區</h2>
          <p className="text-xs text-slate-600">每維 1–5 分（可用數字鍵），總分 20；評分對象只能是機會點（GR-2 由資料模型限定）。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={activeRoundN ?? ''} aria-label="評分輪次" onChange={(e) => setRoundN(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {rounds.map((r) => <option key={r.id} value={r.n}>第 {r.n} 輪{r.status === 'open' ? '（進行中）' : ''}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {['mine', 'all'].map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                {v === 'mine' ? '我的評分' : '全體彙總'}
              </button>
            ))}
          </div>
          {isFacil && roundOpen && <Btn onClick={closeRound}>關閉本輪</Btn>}
          {isFacil && !openRound && <Btn onClick={reopenNewRound}>開新一輪（複議）</Btn>}
        </div>
      </div>

      {!roundOpen && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          第 {activeRoundN} 輪已關閉，分數唯讀。需要修改請由主持人開新一輪。
        </div>
      )}

      {view === 'mine' ? (
        <Section>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">機會點</th>
                  {DIMENSIONS.map((d) => (
                    <th key={d.key} className="py-2 pr-3 font-medium">
                      <button type="button" className="hover:text-indigo-600" title="查看錨點" onClick={() => setAnchorHint(d.key)}>
                        {'①②③④'[d.no - 1]} {d.name}
                      </button>
                    </th>
                  ))}
                  <th className="py-2 pr-3 font-medium">總分</th>
                  <th className="py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {scorable.map((o) => {
                  const mine = myScoreOf(o.id);
                  const locked = !ctx.editable || !roundOpen || mine?.submitted;
                  const axes = mine ? axesOf(mine.dims, criteria?.weighting) : null;
                  return (
                    <tr key={o.id} className="border-b border-slate-100 align-top">
                      <td className="max-w-72 py-2 pr-3">
                        <div className="text-[13px] font-medium leading-snug text-slate-800">{o.opportunityName || '（未命名）'}</div>
                        {o.qualityFlags?.tamMissing && <div className="mt-0.5 text-[11px] text-amber-700">缺 TAM／SAM：維度①依據必填</div>}
                        {plays.some((p) => (p.sourceOppIds || []).includes(o.id)) && (
                          <div className="mt-0.5 text-[11px] text-indigo-600" title="PD-05：系統只提示、不自動填分——分數只抓七八成，最後由討論拍板">
                            本項已編入策略方案，操作潛力可視為滿分（仍需人工點選）
                          </div>
                        )}
                      </td>
                      {DIMENSIONS.map((d) => {
                        const v = mine?.dims?.[d.key] || 0;
                        const needR = (rationaleRequired(v) || (d.key === 'size' && o.qualityFlags?.tamMissing)) && v > 0;
                        return (
                          <td key={d.key} className="py-2 pr-3">
                            <ScorePicker value={v} disabled={locked} onPick={(nv) => setDim(o, d.key, nv)} />
                            {needR && (
                              <input
                                defaultValue={mine?.rationales?.[d.key] || ''}
                                disabled={locked}
                                onBlur={(e) => setRationale(o, d.key, e.target.value)}
                                placeholder="評分依據（必填）"
                                className={`mt-1 w-full rounded border px-1.5 py-1 text-[11px] ${!(mine?.rationales?.[d.key] || '').trim() ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-3">
                        <div className="text-base font-bold tabular-nums text-slate-900">{mine ? totalOf(mine.dims) : '—'}</div>
                        {axes && <div className="text-[11px] text-slate-500">Y {axes.y}｜X {axes.x}</div>}
                      </td>
                      <td className="py-2">
                        {mine?.submitted ? (
                          <div className="space-y-1">
                            <Chip tone="ok">已提交</Chip>
                            {/* 裁定（對抗式審查設計題 #2）：submitted=false 同時代表「草稿私密」
                                與「解鎖重評」是刻意的——解鎖＝該評分回到修訂中，從全體彙總消失
                                （避免以過期分數參與離散度判定）。不另設 locked 旗標。 */}
                            {isFacil && roundOpen && (
                              <button type="button" className="block text-[11px] text-slate-500 hover:text-indigo-600"
                                onClick={() => updateSubDoc(project.id, 'scores', scoreDocId(o.id, activeRoundN, mine.scorerUid), { submitted: false })}>
                                解鎖
                              </button>
                            )}
                          </div>
                        ) : mine && isComplete(mine.dims) ? (
                          <Btn kind="primary" disabled={locked} onClick={() => submitMine(o)}>提交</Btn>
                        ) : (
                          <Chip tone="idle">{mine ? '草稿' : '未填'}</Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section title={`全體彙總（第 ${activeRoundN} 輪）`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">機會點</th>
                  {DIMENSIONS.map((d) => <th key={d.key} className="py-2 pr-3 font-medium">{'①②③④'[d.no - 1]} 平均／中位／極差</th>)}
                  <th className="py-2 pr-3 font-medium">總分</th>
                  <th className="py-2 pr-3 font-medium">評分者</th>
                  <th className="py-2 font-medium">離散度</th>
                </tr>
              </thead>
              <tbody>
                {scorable.map((o) => {
                  const agg = aggregates[o.id];
                  return (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="max-w-72 py-2 pr-3 text-[13px] font-medium text-slate-800">{o.opportunityName || '（未命名）'}</td>
                      {DIMENSIONS.map((d) => {
                        const pd = agg?.perDim?.[d.key];
                        return (
                          <td key={d.key} className={`py-2 pr-3 tabular-nums ${pd?.flagged ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
                            {pd?.count ? `${pd.mean}／${pd.median}／${pd.range}` : '—'}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-3 text-base font-bold tabular-nums">{agg?.scorerCount ? agg.total : '—'}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-600">{agg?.scorerCount || 0}</td>
                      <td className="py-2">{agg?.needsReview ? <Chip tone="fail">需複議（極差 ≥ {dispersionThreshold}）</Chip> : <Chip tone="ok">一致</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            需複議的項目請由主持人「開新一輪」重評；歷史輪次分數保留供比較（FR-03-06）。
          </p>
        </Section>
      )}

      {/* 錨點提示 */}
      <Modal open={!!anchorHint} title="量表錨點" onClose={() => setAnchorHint(null)}>
        {anchorHint && (
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((sc) => (
              <div key={sc} className="flex gap-2 text-sm">
                <span className="w-6 shrink-0 text-center font-bold text-indigo-600">{sc}</span>
                <span className="text-slate-700">{criteria?.anchors?.[anchorHint]?.[sc]}</span>
              </div>
            ))}
            {criteria?.annotations?.[anchorHint] && (
              <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">加註：{criteria.annotations[anchorHint]}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// 1–5 分段條（含鍵盤 1–5 輸入）
function ScorePicker({ value, disabled, onPick }) {
  return (
    <div
      role="radiogroup"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        const n = Number(e.key);
        if (n >= 1 && n <= 5) onPick(n);
      }}
      className="flex gap-0.5 outline-none focus:ring-2 focus:ring-indigo-300"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          className={`h-7 w-7 rounded text-xs font-semibold transition ${
            value === n ? 'bg-indigo-600 text-white'
            : value > n ? 'bg-indigo-200 text-indigo-800'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          } disabled:cursor-not-allowed`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

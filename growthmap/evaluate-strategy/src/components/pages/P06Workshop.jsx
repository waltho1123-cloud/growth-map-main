import { useEffect, useMemo, useRef, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useProjectStore } from '../../store/useProjectStore';
import { setSubDoc, updateSubDoc, subscribeSubcollection, subscribeMyVotes, transactSubDoc } from '../../lib/db';
import {
  createWorkshopDoc, timerRemaining, tallyVotes, buildMinutes, missingResolutions,
} from '../../domain/workshop';
import { fmtTime } from '../../lib/format';
import { downloadText } from '../../lib/download';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal, TextInput } from '../common/ui';

// P-06 工作坊主持台：議程計時（雲端同步）＋匿名投票（半記名，PD-08）＋意見板＋決議＋紀錄。
// 主持人（owner/facilitator）看主持視圖；其他成員看參與視圖。
export default function P06Workshop({ ctx, n }) {
  const project = useProjectStore((s) => s.project);
  const workshops = useProjectStore((s) => s.workshops);
  const wsOpinions = useProjectStore((s) => s.wsOpinions);
  const ws = workshops.find((w) => w.n === n);
  const isFacil = ctx.role === 'owner' || ctx.role === 'facilitator';
  const [, forceTick] = useState(0);
  const [voteDocs, setVoteDocs] = useState([]); // 主持人才訂得到全量（規則半記名）
  const votesReadyRef = useRef(false); // 首個 wsVotes 快照已到（#1 歸零回歸的閘門；ref＝不需獨立重繪）
  const [newVote, setNewVote] = useState(null); // { title, optionsText }
  const [opinionText, setOpinionText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [timerNotice, setTimerNotice] = useState('');

  // 計時器每秒重繪
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 原始票訂閱：主持人彙總回寫 tally；一般成員此訂閱會被規則擋（onError 靜默）。
  // votesReady：對帳 effect 必須等第一個快照——否則掛載瞬間 voteDocs=[] 會把
  // 所有票數（含已截止的正式結果）寫成 0（code-review 嚴重回歸 #1）。
  useEffect(() => {
    if (!project?.id || !isFacil) return undefined;
    votesReadyRef.current = false;
    return subscribeSubcollection(project.id, 'wsVotes', (rows) => {
      votesReadyRef.current = true; // 先標 ready 再 setState——對帳 effect 由 voteDocs 觸發
      setVoteDocs(rows);
    }, () => {});
  }, [project?.id, isFacil]);

  // 自己的票（所有成員可讀自己的原始票）：顯示「我投了哪項」
  const [myVotes, setMyVotes] = useState({});
  useEffect(() => {
    if (!project?.id) return undefined;
    return subscribeMyVotes(project.id, ctx.user.uid, (rows) => {
      setMyVotes(Object.fromEntries(rows.filter((v) => v.workshopN === n).map((v) => [v.voteKey, v.choice])));
    }, () => {});
  }, [project?.id, ctx.user.uid, n]);

  // 主持人端：票數變動 → 彙總寫回 workshop.votes（參與者只看 tally）。
  // 開放與已截止的投票「都」持續對帳（對抗式審查 P1：截止競態下最後一票的
  // voteDocs 快照晚到，若只彙總 open 會永久凍結錯票數；截止後原始票被規則
  // 凍結，對帳收斂即正確值）。寫入前比對現值，兩位主持人併發也會收斂不迴圈。
  useEffect(() => {
    if (!isFacil || !ws || !votesReadyRef.current) return; // ready 閘門：防掛載空快照歸零
    const votes = ws.votes || {};
    const patch2 = {}; // 一次合併寫入（#13：N 票分 N 筆寫會觸發 N 輪重算）
    for (const [key, v] of Object.entries(votes)) {
      const { tally, voters } = tallyVotes(voteDocs.filter((d) => d.workshopN === n), key, (v.options || []).length);
      if (JSON.stringify(tally) !== JSON.stringify(v.tally) || voters !== (v.voters || 0)) {
        patch2[`votes.${key}.tally`] = tally;
        patch2[`votes.${key}.voters`] = voters;
      }
    }
    if (Object.keys(patch2).length > 0) {
      updateSubDoc(project.id, 'workshops', String(n), patch2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteDocs, ws?.votes, isFacil]);

  const opinions = useMemo(
    () => wsOpinions.filter((o) => o.workshopN === n)
      .sort((a, b) => Object.keys(b.likes || {}).length - Object.keys(a.likes || {}).length),
    [wsOpinions, n]
  );

  if (!ws) {
    return (
      <div className="space-y-4">
        <Header n={n} />
        <EmptyState
          text={`第${n === 1 ? '一' : '二'}次工作坊尚未建立。主持人建立後，所有成員會即時看到議程與計時。`}
          actionLabel={isFacil ? '建立工作坊（標準 3 小時議程）' : undefined}
          onAction={() => setSubDoc(project.id, 'workshops', String(n), createWorkshopDoc(n))}
        />
        {isFacil && (
          <div className="text-center">
            <Btn onClick={() => setSubDoc(project.id, 'workshops', String(n), createWorkshopDoc(n, { doubled: true }))}>
              建立內部場（所有時段 ×2）
            </Btn>
          </div>
        )}
      </div>
    );
  }

  const patch = (p) => updateSubDoc(project.id, 'workshops', String(n), p);
  const current = ws.agenda?.[ws.currentIndex];
  const remaining = timerRemaining(ws.timer);
  const overtime = remaining < 0;

  // 計時起點用 serverTimestamp（防主持人時鐘偏差）；暫停/繼續/延長走交易式
  // 狀態轉移（對抗式審查 P2：兩位主持人併發時 LWW 會讓過期的 pause 蓋掉新議程）
  // ——交易內驗前提（議程沒被切走、計時器仍在預期狀態），不成立就放棄寫入。
  const startItem = (idx) => {
    const item = ws.agenda[idx];
    patch({
      currentIndex: idx,
      status: 'running',
      timer: { startedAt: serverTimestamp(), durationSec: item.minutes * 60, pausedRemainingSec: null },
    });
  };
  // 交易失敗（離線／衝突）不得靜默（#3）：交易需要連線，離線時明確提示重試。
  // 已知接受（#11 記錄）：交易前提比對「伺服器現值 vs 本地樂觀回顯」在剛切議程
  // 的亞秒窗口內可能靜默放棄一次點擊——重按即恢復，修它的複雜度不值。
  const timerOp = (fn) => fn().catch(() => {
    setTimerNotice('計時操作未生效（離線或與其他主持人衝突）——請確認連線後重試。');
    setTimeout(() => setTimerNotice(''), 6000);
  });
  const pauseTimer = () => timerOp(() => transactSubDoc(project.id, 'workshops', String(n), (data) => {
    if (data.currentIndex !== ws.currentIndex || !data.timer?.startedAt) return null;
    const rem = timerRemaining(data.timer); // #15：時鐘數學唯一正本在 domain/workshop
    return { timer: { durationSec: data.timer.durationSec || 0, pausedRemainingSec: rem, startedAt: null } };
  }));
  const resumeTimer = () => timerOp(() => transactSubDoc(project.id, 'workshops', String(n), (data) => {
    if (data.currentIndex !== ws.currentIndex || data.timer?.pausedRemainingSec == null) return null;
    return { timer: { startedAt: serverTimestamp(), durationSec: data.timer.pausedRemainingSec, pausedRemainingSec: null } };
  }));
  const extendTimer = (min) => timerOp(() => transactSubDoc(project.id, 'workshops', String(n), (data) => {
    if (data.currentIndex !== ws.currentIndex || !data.timer) return null;
    return data.timer.pausedRemainingSec != null
      ? { 'timer.pausedRemainingSec': data.timer.pausedRemainingSec + min * 60 }
      : { 'timer.durationSec': (data.timer.durationSec || 0) + min * 60 };
  }));

  const addResolution = () => {
    const text = resolutionText.trim();
    if (!text || !current) return;
    const cur = ws.resolutions?.[current.key] || [];
    patch({ [`resolutions.${current.key}`]: [...cur, { text, by: ctx.user.displayName || ctx.user.email, at: Date.now() }] });
    setResolutionText('');
  };

  const createVote = () => {
    const options = newVote.optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!newVote.title.trim() || options.length < 2) return;
    const key = `v${Date.now()}`;
    patch({ [`votes.${key}`]: { title: newVote.title.trim(), options, status: 'open', tally: {}, voters: 0, createdAt: Date.now() } });
    setNewVote(null);
  };

  const castVote = (voteKey, choice) => {
    setSubDoc(project.id, 'wsVotes', `${n}__${voteKey}__${ctx.user.uid}`, {
      workshopN: n, voteKey, voterUid: ctx.user.uid, choice, at: Date.now(),
    });
  };

  const submitOpinion = () => {
    const text = opinionText.trim();
    if (!text) return;
    setSubDoc(project.id, 'wsOpinions', `op-${Date.now()}-${ctx.user.uid.slice(0, 6)}`, {
      workshopN: n, text, authorUid: ctx.user.uid, likes: {}, createdAt: Date.now(),
    });
    setOpinionText('');
  };

  const toggleLike = (op) => {
    const likes = { ...(op.likes || {}) };
    if (likes[ctx.user.uid]) delete likes[ctx.user.uid];
    else likes[ctx.user.uid] = true;
    updateSubDoc(project.id, 'wsOpinions', op.id, { likes });
  };

  const endMeeting = () => {
    const missing = missingResolutions(ws);
    if (missing.length && !window.confirm(`下列「取得共識」議程還沒有決議：${missing.join('、')}。仍要結束？`)) return;
    // #5：會議紀錄是永久檔——結束前用「本地最新原始票」做最終對帳，
    // 不信任可能落後的 ws.votes；修正後的 tally 與 minutes 同一筆寫入。
    const finalVotes = {};
    const finalPatch = {};
    for (const [key, v] of Object.entries(ws.votes || {})) {
      const fin = tallyVotes(voteDocs.filter((d) => d.workshopN === n), key, (v.options || []).length);
      // 不回退保護：本地快照比現值舊（票更少）時保留現值（同 #8 截止語意）
      const useFin = fin.voters >= (v.voters || 0);
      finalVotes[key] = { ...v, tally: useFin ? fin.tally : v.tally, voters: useFin ? fin.voters : (v.voters || 0), status: 'closed' };
      finalPatch[`votes.${key}`] = finalVotes[key];
    }
    const minutes = buildMinutes({ ...ws, votes: finalVotes }, { projectName: project.name, opinions });
    patch({ status: 'ended', endedAt: Date.now(), minutes, ...finalPatch });
  };

  const downloadMinutes = () => {
    downloadText(`工作坊${n}_會議紀錄_${project.name}.md`, ws.minutes || buildMinutes(ws, { projectName: project.name, opinions }));
  };

  const mm = Math.floor(Math.abs(remaining) / 60);
  const ss = String(Math.abs(remaining) % 60).padStart(2, '0');

  return (
    <div className="space-y-4">
      <Header n={n} aside={
        <div className="flex items-center gap-2">
          <Chip tone={ws.status === 'running' ? 'ok' : ws.status === 'ended' ? 'idle' : 'warn'}>
            {{ pending: '未開始', running: '進行中', ended: '已結束' }[ws.status]}
          </Chip>
          {ws.status === 'ended' && <Btn onClick={downloadMinutes}>下載會議紀錄</Btn>}
          {isFacil && ws.status !== 'ended' && <Btn kind="danger" onClick={endMeeting}>結束會議並產出紀錄</Btn>}
        </div>
      } />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 左：議程列表 */}
        <Section title="議程">
          <div className="space-y-1.5">
            {(ws.agenda || []).map((item, idx) => (
              <div key={item.key}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${idx === ws.currentIndex && ws.status === 'running' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-800">{item.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.minutes} 分鐘{item.goal ? `｜${item.goal}` : ''}
                    {(ws.resolutions?.[item.key] || []).length > 0 && `｜決議 ${(ws.resolutions[item.key]).length} 條`}
                  </div>
                </div>
                {isFacil && ws.status !== 'ended' && (
                  <Btn kind="ghost" onClick={() => startItem(idx)}>{idx === ws.currentIndex && ws.status === 'running' ? '重計時' : '開始'}</Btn>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 中：目前議題＋計時器＋決議 */}
        <Section title={current ? `目前議題：${current.title}` : '尚未開始'}>
          <div className={`mb-3 rounded-xl py-6 text-center text-5xl font-bold tabular-nums ${overtime ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-900'}`}>
            {overtime ? '−' : ''}{mm}:{ss}
            {overtime && <div className="mt-1 text-xs font-normal text-red-600">已超時（不強制中斷）</div>}
          </div>
          {timerNotice && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs text-amber-800">{timerNotice}</p>
          )}
          {isFacil && ws.status === 'running' && (
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {ws.timer?.pausedRemainingSec != null
                ? <Btn onClick={resumeTimer}>繼續</Btn>
                : <Btn onClick={pauseTimer}>暫停</Btn>}
              <Btn onClick={() => extendTimer(5)}>＋5 分鐘</Btn>
              {ws.currentIndex < (ws.agenda?.length || 0) - 1 && (
                <Btn kind="primary" onClick={() => startItem(ws.currentIndex + 1)}>下一議程 →</Btn>
              )}
            </div>
          )}
          {current?.goal && <p className="mb-2 text-center text-xs text-slate-500">目標：{current.goal}</p>}

          <div className="border-t border-slate-100 pt-2">
            <div className="mb-1 text-xs font-semibold text-slate-500">本段決議{current?.needsResolution ? '（此段需取得共識）' : ''}</div>
            {(ws.resolutions?.[current?.key] || []).map((r, i) => (
              <div key={i} className="mb-1 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
                {i + 1}. {r.text} <span className="text-[10px] text-emerald-700">{r.by}・{fmtTime(r.at)}</span>
              </div>
            ))}
            {ctx.editable && ws.status === 'running' && (
              <div className="mt-1.5 flex gap-2">
                <input value={resolutionText} onChange={(e) => setResolutionText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addResolution(); }}
                  placeholder="記下一條決議…"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
                <Btn onClick={addResolution}>記錄</Btn>
              </div>
            )}
          </div>

          {n === 1
            ? <p className="mt-3 text-center text-[11px] text-slate-500">評估與排序請開分頁到 <button className="text-indigo-600 underline" onClick={() => navigate('matrix')}>優先排序矩陣</button> 投影</p>
            : <p className="mt-3 text-center text-[11px] text-slate-500">效益與時序請開分頁到 <button className="text-indigo-600 underline" onClick={() => navigate('rollup')}>疊加效益</button>／<button className="text-indigo-600 underline" onClick={() => navigate('sequencing')}>時序彙總</button> 投影</p>}
        </Section>

        {/* 右：投票＋意見板 */}
        <div className="space-y-4">
          <Section title="匿名投票"
            aside={isFacil && ws.status !== 'ended' ? <Btn kind="ghost" onClick={() => setNewVote({ title: '', optionsText: '' })}>＋ 發起投票</Btn> : null}>
            {Object.entries(ws.votes || {}).length === 0 && (
              <p className="text-xs text-slate-600">尚無投票。介面匿名呈現；系統留存投票紀錄以防重投（PD-08 半記名——僅主持人可查原始票）。</p>
            )}
            <div className="space-y-3">
              {Object.entries(ws.votes || {}).sort(([, a], [, b]) => (a.createdAt || 0) - (b.createdAt || 0)).map(([key, v]) => {
                const total = Math.max(1, v.voters || 0);
                return (
                  <div key={key} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{v.title}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">{v.voters || 0} 票</span>
                        {isFacil && v.status === 'open' && (
                          <Btn kind="ghost" onClick={() => {
                            // 截止＝最終彙總＋關閉同一筆寫入；#8 不回退保護：本地快照
                            // 比現值舊（票更少＝另一位主持人的彙總較新）時只關不覆寫，
                            // 晚到的票由對帳 effect 收斂
                            const fin = tallyVotes(voteDocs.filter((d2) => d2.workshopN === n), key, (v.options || []).length);
                            const p2 = { [`votes.${key}.status`]: 'closed' };
                            if (fin.voters >= (v.voters || 0)) {
                              p2[`votes.${key}.tally`] = fin.tally;
                              p2[`votes.${key}.voters`] = fin.voters;
                            }
                            patch(p2);
                          }}>截止</Btn>
                        )}
                        {v.status === 'closed' && <Chip tone="idle">已截止</Chip>}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(v.options || []).map((opt, i) => {
                        const count = v.tally?.[i] ?? 0;
                        const mine = myVotes[key] === i;
                        return (
                          <button key={i} type="button"
                            disabled={v.status !== 'open' || ws.status === 'ended'}
                            onClick={() => castVote(key, i)}
                            className={`block w-full rounded-lg border px-2 py-1 text-left text-sm disabled:cursor-not-allowed ${mine ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                            <span className="flex items-center justify-between">
                              <span>{mine ? '● ' : ''}{opt}</span>
                              <span className="tabular-nums text-xs text-slate-500">{count}</span>
                            </span>
                            <span className="mt-0.5 block h-1 overflow-hidden rounded bg-slate-100">
                              <span className="block h-full bg-indigo-500" style={{ width: `${(count / total) * 100}%` }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={`匿名意見板（${opinions.length}）`}>
            {ws.status !== 'ended' && (
              <div className="mb-2 flex gap-2">
                <input value={opinionText} onChange={(e) => setOpinionText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitOpinion(); }}
                  placeholder="提出卡點或意見（匿名呈現）…"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
                <Btn onClick={submitOpinion}>送出</Btn>
              </div>
            )}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {opinions.map((op) => (
                <div key={op.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="text-sm leading-relaxed text-slate-700">{op.text}</span>
                  <button type="button" onClick={() => toggleLike(op)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${op.likes?.[ctx.user.uid] ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
                    👍 {Object.keys(op.likes || {}).length}
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {ws.status === 'ended' && ws.minutes && (
        <Section title="會議紀錄" aside={<Btn onClick={downloadMinutes}>下載 .md</Btn>}>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{ws.minutes}</pre>
        </Section>
      )}

      <Modal open={!!newVote} title="發起匿名投票" onClose={() => setNewVote(null)}>
        {newVote && (
          <div className="space-y-2">
            <TextInput value={newVote.title} onCommit={(v) => setNewVote((c) => ({ ...c, title: v }))} placeholder="投票題目（例：短名單第三席給誰？）" />
            <textarea rows={4} value={newVote.optionsText}
              onChange={(e) => setNewVote((c) => ({ ...c, optionsText: e.target.value }))}
              placeholder={'選項一行一個（至少兩個）'}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setNewVote(null)}>取消</Btn>
              <Btn kind="primary" onClick={createVote}>建立</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Header({ n, aside }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold text-slate-900">第{n === 1 ? '一' : '二'}次評估策略工作坊</h2>
        <p className="text-xs text-slate-600">
          {n === 1 ? '任務 1.3：評估、排序、投票——三小時取得優先排序共識。' : '任務 3.4：確認最終策略方案與執行時序——最終拍板。'}
        </p>
      </div>
      {aside}
    </div>
  );
}

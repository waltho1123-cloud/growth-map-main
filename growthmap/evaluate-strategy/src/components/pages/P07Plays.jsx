import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { addSubDoc, updateSubDoc, deleteSubDoc } from '../../lib/db';
import { createPlayDoc, MERGE_CRITERIA_OPTIONS } from '../../domain/model';
import { playCountStatus } from '../../domain/guards';
import { logEvent } from '../../lib/events';
import { navigate } from '../../lib/useHashRoute';
import { Section, Btn, Chip, EmptyState, Modal, TextInput, TextArea } from '../common/ui';

// P-07 策略方案編組：短名單機會 → 整合/延伸為 1–3 個策略方案（GR-4）
export default function P07Plays({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const plays = useProjectStore((s) => s.plays);
  const [selected, setSelected] = useState([]); // 機會池勾選（建立新方案用）
  const [creating, setCreating] = useState(false);
  const [dissolveTarget, setDissolveTarget] = useState(null);
  const [dissolveText, setDissolveText] = useState('');

  const settings = project?.settings || {};
  const countStatus = playCountStatus(plays.length, { warnAt: settings.playWarn || 3, max: settings.playMax || 5 });

  const inPlayIds = useMemo(() => new Set(plays.flatMap((p) => p.sourceOppIds || [])), [plays]);
  const shortlist = opportunities.filter((o) => o.shortlist?.included);
  const pool = shortlist.filter((o) => !inPlayIds.has(o.id));
  const reserve = opportunities.filter((o) => !o.shortlist?.included && !o.excluded?.flag && o.lastAggregate && !inPlayIds.has(o.id));

  if (shortlist.length === 0 && plays.length === 0) {
    return (
      <EmptyState text="還沒選出優先機會。先在矩陣上圈出你要押的注。"
        actionLabel="前往優先排序矩陣" onAction={() => navigate('matrix')} />
    );
  }

  const toggleSelect = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const addToPlay = async (play, oppId) => {
    if (!ctx.editable) return;
    await updateSubDoc(project.id, 'plays', play.id, { sourceOppIds: [...(play.sourceOppIds || []), oppId] });
  };

  const removeFromPlay = async (play, oppId) => {
    await updateSubDoc(project.id, 'plays', play.id, { sourceOppIds: (play.sourceOppIds || []).filter((x) => x !== oppId) });
  };

  const dissolve = async () => {
    if (dissolveText !== dissolveTarget?.name) return; // CFM-03：輸入方案名稱確認
    await deleteSubDoc(project.id, 'plays', dissolveTarget.id);
    setDissolveTarget(null);
    setDissolveText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">策略方案編組</h2>
          <p className="text-xs text-slate-600">
            整合＝「手機殼＋行動電源＋螢幕保護貼 → 手機周邊商品」；延伸＝「相機模組市場 → 視覺解決方案市場」。
            統一稱「策略方案（Strategic Play）」。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={countStatus.level === 'ok' ? 'ok' : countStatus.level === 'block' ? 'fail' : countStatus.level === 'warn' ? 'warn' : 'idle'}>
            方案數 {plays.length} / 1–3（上限 {settings.playMax || 5}）
          </Chip>
          {ctx.editable && (
            <Btn kind="primary" disabled={selected.length === 0 || countStatus.level === 'block'}
              onClick={() => setCreating(true)}>
              以勾選機會建立方案（{selected.length}）
            </Btn>
          )}
        </div>
      </div>

      {countStatus.level !== 'ok' && countStatus.level !== 'empty' && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${countStatus.level === 'block' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {countStatus.message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 左欄 機會池 */}
        <Section title={`機會池（短名單 ${pool.length}）`}>
          <div className="space-y-2">
            {pool.map((o) => (
              <div key={o.id} className={`rounded-lg border px-2.5 py-2 ${selected.includes(o.id) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                <label className="flex items-start gap-2">
                  {ctx.editable && (
                    <input type="checkbox" className="mt-0.5" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-snug text-slate-800">{o.opportunityName}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      總分 {o.lastAggregate?.total ?? '—'}｜Y {o.lastAggregate?.axes?.y ?? '—'}｜X {o.lastAggregate?.axes?.x ?? '—'}
                    </span>
                  </span>
                </label>
                {ctx.editable && plays.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {plays.map((p) => (
                      <button key={p.id} type="button" onClick={() => addToPlay(p, o.id)}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-indigo-100 hover:text-indigo-700">
                        ＋{p.name || '未命名'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pool.length === 0 && <p className="text-xs text-slate-600">短名單機會都已編入方案。</p>}
          </div>

          {reserve.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">保留池／未入短名單（仍可拉入）</summary>
              <div className="mt-1.5 space-y-1">
                {reserve.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                    <span className="min-w-0 truncate">{o.opportunityName}</span>
                    {ctx.editable && (
                      <label className="flex shrink-0 items-center gap-1">
                        <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} />選取
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </Section>

        {/* 中＋右欄 方案卡 */}
        <div className="space-y-3 lg:col-span-2">
          {plays.length === 0 ? (
            <EmptyState text="勾選左側機會，建立第一個策略方案。合併時需勾選判準（至少一項）；延伸時需寫出更廣泛的主題。" />
          ) : (
            plays.map((p) => (
              <PlayCard key={p.id} play={p} ctx={ctx} project={project}
                opportunities={opportunities}
                onRemoveSource={(oppId) => removeFromPlay(p, oppId)}
                onDissolve={() => { setDissolveTarget(p); setDissolveText(''); }} />
            ))
          )}
        </div>
      </div>

      {plays.length >= 1 && countStatus.level !== 'block' && (
        <div className="flex justify-end">
          <Btn kind="primary" onClick={() => navigate('bizplan')}>進入步驟四：三模板重整與商業計劃 →</Btn>
        </div>
      )}
      {countStatus.level === 'block' && (
        <div className="flex justify-end">
          <Btn kind="primary" disabled title="策略方案超過硬上限，請先合併或擱置">進入步驟四（已停用）</Btn>
        </div>
      )}

      <CreatePlayModal
        open={creating}
        onClose={() => setCreating(false)}
        ctx={ctx}
        project={project}
        sourceOpps={opportunities.filter((o) => selected.includes(o.id))}
        afterCreate={() => { setSelected([]); setCreating(false); }}
      />

      {/* CFM-03 解散方案：輸入名稱確認 */}
      <Modal open={!!dissolveTarget} title="解散策略方案" onClose={() => setDissolveTarget(null)}>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          解散後，「{dissolveTarget?.name}」的三模板與商業計劃將刪除，來源機會回到機會池。
          輸入方案名稱以確認：
        </p>
        <TextInput value={dissolveText} onCommit={setDissolveText} placeholder={dissolveTarget?.name} ariaLabel="輸入方案名稱以確認解散" />
        <div className="mt-3 flex justify-end gap-2">
          <Btn onClick={() => setDissolveTarget(null)}>取消</Btn>
          <Btn kind="danger" disabled={dissolveText !== dissolveTarget?.name} onClick={dissolve}>確認解散</Btn>
        </div>
      </Modal>
    </div>
  );
}

function PlayCard({ play, ctx, project, opportunities, onRemoveSource, onDissolve }) {
  const sources = (play.sourceOppIds || []).map((id) => opportunities.find((o) => o.id === id)).filter(Boolean);
  const confirmed = ['t1', 't2', 't3'].filter((k) => play.templates?.[k]?.confirmed).length;
  const patch = (p2) => updateSubDoc(project.id, 'plays', play.id, p2);
  const disabled = !ctx.editable;

  return (
    <Section
      title={play.name || '未命名方案'}
      aside={
        <div className="flex items-center gap-2">
          <Chip tone={confirmed === 3 ? 'ok' : 'idle'}>模板 {confirmed}/3</Chip>
          <Btn kind="ghost" onClick={() => navigate(`plays/${play.id}/templates`)}>三模板</Btn>
          <Btn kind="ghost" onClick={() => navigate(`plays/${play.id}/bizplan`)}>商業計劃</Btn>
          {ctx.editable && <Btn kind="ghost" onClick={onDissolve}>解散</Btn>}
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">方案名稱（建議市場／賽道層級的名詞）</label>
            <TextInput value={play.name} disabled={disabled} ariaLabel="方案名稱" onCommit={(v) => patch({ name: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">一句話說明</label>
            <TextInput value={play.oneLiner} disabled={disabled} ariaLabel="方案一句話說明" onCommit={(v) => patch({ oneLiner: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">方案負責人</label>
            <select value={play.ownerUid || ''} disabled={disabled} aria-label={`${play.name || '方案'} 負責人`}
              onChange={(e) => patch({ ownerUid: e.target.value || null })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">未指派</option>
              {Object.entries(project.members || {}).filter(([, m]) => m.role !== 'coach').map(([uid, m]) => (
                <option key={uid} value={uid}>{m.displayName || m.email}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">形成方式</label>
            <div className="flex gap-3 text-sm">
              {[['merge', '整合而成'], ['extend', '延伸而成']].map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name={`formation-${play.id}`} disabled={disabled}
                    checked={play.formation === v} onChange={() => patch({ formation: v })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {play.formation === 'merge' ? (
            <div>
              <label className="mb-1 block text-xs text-slate-500">合併判準（至少勾一項，否則不得儲存為完成）</label>
              <div className="space-y-1">
                {MERGE_CRITERIA_OPTIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" disabled={disabled}
                      checked={(play.mergeCriteria || []).includes(c)}
                      onChange={(e) => patch({
                        mergeCriteria: e.target.checked
                          ? [...(play.mergeCriteria || []), c]
                          : (play.mergeCriteria || []).filter((x) => x !== c),
                      })} />
                    {c}
                  </label>
                ))}
              </div>
              {(play.mergeCriteria || []).length === 0 && <p className="mt-1 text-xs text-red-600">整合型方案必須勾選至少一項判準（GR-4 前置）。</p>}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-500">延伸主題（提煉出的更廣泛主題／價值主張，必填）</label>
              <TextArea rows={2} disabled={disabled} value={play.extendTheme} ariaLabel="延伸主題"
                onCommit={(v) => patch({ extendTheme: v })} />
              {!(play.extendTheme || '').trim() && <p className="mt-1 text-xs text-red-600">延伸型方案必須填寫延伸主題。</p>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs text-slate-500">來源機會點（{sources.length}）</div>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800">
              {o.opportunityName}
              {ctx.editable && (
                <button type="button" className="text-indigo-300 hover:text-red-600" onClick={() => onRemoveSource(o.id)}>✕</button>
              )}
            </span>
          ))}
          {sources.length === 0 && <span className="text-xs text-red-600">尚無來源機會——方案必須由機會點形成。</span>}
        </div>
      </div>
    </Section>
  );
}

function CreatePlayModal({ open, onClose, ctx, project, sourceOpps, afterCreate }) {
  const [name, setName] = useState('');
  const [formation, setFormation] = useState('merge');
  const [criteria, setCriteria] = useState([]);
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim()
    && (formation === 'merge' ? criteria.length > 0 : theme.trim().length > 0)
    && sourceOpps.length > 0;

  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const doc = createPlayDoc({
        name: name.trim(),
        formation,
        mergeCriteria: formation === 'merge' ? criteria : [],
        extendTheme: formation === 'extend' ? theme.trim() : '',
        sourceOppIds: sourceOpps.map((o) => o.id),
        ownerUid: ctx.user.uid,
        oneLiner: '',
      }, sourceOpps, { forecastYears: project?.settings?.forecastYears || 3 });
      await addSubDoc(project.id, 'plays', doc);
      logEvent(project.id, 'play.created', { formation, sourceCount: sourceOpps.length }, ctx.user.uid); // EVT-07
      afterCreate();
      setName(''); setCriteria([]); setTheme('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={`建立策略方案（來源 ${sourceOpps.length} 個機會）`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {sourceOpps.map((o) => <Chip key={o.id} tone="brand">{o.opportunityName}</Chip>)}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">方案名稱</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="例：手機周邊商品"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex gap-4 text-sm">
          {[['merge', '整合而成（多機會合併）'], ['extend', '延伸而成（單機會拉高）']].map(([v, label]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" checked={formation === v} onChange={() => setFormation(v)} />{label}
            </label>
          ))}
        </div>
        {formation === 'merge' ? (
          <div className="space-y-1">
            {MERGE_CRITERIA_OPTIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={criteria.includes(c)}
                  onChange={(e) => setCriteria(e.target.checked ? [...criteria, c] : criteria.filter((x) => x !== c))} />
                {c}
              </label>
            ))}
          </div>
        ) : (
          <textarea rows={2} value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder="提煉出的更廣泛主題或價值主張…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        )}
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          建立後會自動彙整來源機會的模板一～三為<b>底稿（未確認）</b>——合併過的方案要重寫模板（GR-6），未逐張確認不得進入商業計劃。
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>取消</Btn>
          <Btn kind="primary" disabled={!valid || busy} onClick={create}>建立方案</Btn>
        </div>
      </div>
    </Modal>
  );
}

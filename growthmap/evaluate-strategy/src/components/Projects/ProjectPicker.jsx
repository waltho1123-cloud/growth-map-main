import { useEffect, useState } from 'react';
import { subscribeMyProjects, subscribeMyInvites, createProject, joinProject } from '../../lib/db';
import { logEvent } from '../../lib/events';
import { ROLES } from '../../domain/model';
import { fmtTime } from '../../lib/format';
import { Btn, Chip, Modal } from '../common/ui';
import { signOut } from '../../lib/cloud/auth';

// 專案選擇（多人協作入口）：我的專案／邀請我的專案／建立新專案
export default function ProjectPicker({ user, onSelect }) {
  const [projects, setProjects] = useState(null); // null=載入中
  const [invites, setInvites] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const u1 = subscribeMyProjects(user.uid, setProjects, (e) => setError(e.message));
    const u2 = subscribeMyInvites((user.email || '').toLowerCase(), setInvites, () => {});
    return () => { u1(); u2(); };
  }, [user.uid, user.email]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const pid = await createProject(user, name.trim());
      logEvent(pid, 'evaluate.project_started', {}, user.uid); // EVT-01（BG-01 週期起點）
      onSelect(pid);
    } catch (e) {
      setError(`建立失敗：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async (pid) => {
    setBusy(true);
    setError('');
    try {
      await joinProject(pid, user);
      onSelect(pid);
    } catch (e) {
      setError(`加入失敗：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <a href="/" className="mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
            <span>←</span>
            <span>返回藍圖</span>
          </a>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
          </h1>
          <p className="mt-1 text-sm text-slate-500">評估策略 (Evaluate)</p>
          <h2 className="mt-4 text-lg font-bold text-slate-900">選擇評估專案</h2>
          <p className="mt-0.5 text-sm text-slate-600">{user.displayName || user.email}</p>
        </div>
        <Btn onClick={() => signOut()}>登出</Btn>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {invites.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">邀請我加入</h2>
          <div className="space-y-2">
            {invites.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-600">
                    角色：{ROLES[p.inviteRoles?.[(user.email || '').toLowerCase()]]?.label || '成員'}
                  </div>
                </div>
                <Btn kind="primary" disabled={busy} onClick={() => join(p.id)}>加入</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">我的專案</h2>
        <Btn kind="primary" onClick={() => setCreating(true)}>＋ 建立評估專案</Btn>
      </div>

      {projects === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">載入中…</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          還沒有評估專案。建立一個，然後從第三堂把增長機會長清單帶進來。
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const role = p.members?.[user.uid]?.role;
            return (
              <button key={p.id} type="button" onClick={() => onSelect(p.id)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    建立於 {fmtTime(p.createdAt)} · 成員 {p.memberUids?.length || 0} 人
                    {p.source ? ` · 已承接 v${p.source.version}` : ' · 尚未承接長清單'}
                  </div>
                </div>
                <Chip tone={role === 'coach' ? 'idle' : 'brand'}>{ROLES[role]?.label || role}</Chip>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={creating} title="建立評估專案" onClose={() => setCreating(false)}>
        <p className="mb-3 text-sm text-slate-600">
          一個專案對應一個事業單位的一輪「評估策略」（PD-11：單一事業單位為範圍；多 BU 各自建案）。
        </p>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          placeholder="例：2026 寵物事業群 評估策略"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setCreating(false)}>取消</Btn>
          <Btn kind="primary" disabled={!name.trim() || busy} onClick={create}>建立</Btn>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  updateProject, inviteMember, revokeInvite, updateMemberRole, removeMember,
  deleteProject, updateSubDoc, getSubDocs,
} from '../../lib/db';
import { resizeFin } from '../../domain/finance';
import { downloadJson } from '../../lib/download';
import { ROLES } from '../../domain/model';
import { Section, Btn, TextInput, NumInput, Chip, Modal } from '../common/ui';

// P-18 設定（本版落地子集）＋成員與邀請管理
export default function SettingsPage({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const plays = useProjectStore((s) => s.plays);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState('');

  if (!project) return null;
  const s = project.settings || {};
  const disabled = !ctx.editable;
  const isOwner = ctx.role === 'owner';
  const canInvite = ctx.role === 'owner' || ctx.role === 'facilitator'; // 與 rules 的邀請欄位權限對齊

  // field-path 寫入（settings.xxx），不整包覆寫——防兩人並行改不同設定互相蓋寫
  const patchSettings = (patch) => updateProject(
    project.id,
    Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v]))
  );

  // PD-04：年期變更同步遷移所有方案財務表（截斷/補零）
  const changeYears = async (years) => {
    const y = Math.min(5, Math.max(3, Math.round(Number(years) || 3)));
    await patchSettings({ forecastYears: y });
    await Promise.all(plays.map((p) =>
      updateSubDoc(project.id, 'plays', p.id, { 'bizplan.fin': resizeFin(p.bizplan?.fin, y) })
    ));
    // 綜效陣列同步年期（field-path，不動 beneficiary/note）
    const fit = (arr) => Array.from({ length: y }, (_, i) => Number(arr?.[i]) || 0);
    await updateProject(project.id, {
      'synergies.revenue': fit(project.synergies?.revenue),
      'synergies.cost': fit(project.synergies?.cost),
    });
  };

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    try {
      await inviteMember(project, email, inviteRole);
      setInviteEmail('');
      setMsg(`已邀請 ${email}（對方登入後在專案清單接受邀請）`);
    } catch (e) {
      setMsg(`邀請失敗：${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">設定與成員</h2>
      {msg && <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="專案">
          <label className="mb-1 block text-xs text-slate-500">專案名稱</label>
          <TextInput value={project.name} disabled={disabled} ariaLabel="專案名稱" onCommit={(v) => updateProject(project.id, { name: v })} />
        </Section>

        <Section title="方案規則（PD-03）">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">警示門檻（建議 1–3）</label>
              <NumInput value={s.playWarn ?? 3} disabled={disabled} ariaLabel="方案數警示門檻" onCommit={(v) => patchSettings({ playWarn: Math.max(1, Math.min(5, v || 3)) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">硬上限（不得 &gt;5）</label>
              <NumInput value={s.playMax ?? 5} disabled={disabled} ariaLabel="方案數硬上限" onCommit={(v) => patchSettings({ playMax: Math.max(1, Math.min(5, v || 5)) })} />
            </div>
          </div>
        </Section>

        <Section title="財務（OQ-A 預設值，可調）">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">所得稅率（0–1，預設 0.2）</label>
              <NumInput value={s.taxRate ?? 0.2} disabled={disabled} ariaLabel="所得稅率" onCommit={(v) => patchSettings({ taxRate: Math.max(0, Math.min(1, v)) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">預測年期（3–5，PD-04）</label>
              <NumInput value={s.forecastYears ?? 3} disabled={disabled} ariaLabel="預測年期" onCommit={changeYears} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">可用資金上限（現金流硬檢查）</label>
              <NumInput value={s.availableCapital ?? ''} disabled={disabled} ariaLabel="可用資金上限" onCommit={(v) => patchSettings({ availableCapital: v })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">可用 FTE 上限</label>
              <NumInput value={s.availableFte ?? ''} disabled={disabled} ariaLabel="可用 FTE 上限" onCommit={(v) => patchSettings({ availableFte: v })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">幣別／單位（表頭標示）</label>
              <TextInput value={`${s.currency || 'TWD'} ${s.unit || 'M'}`} disabled={disabled} ariaLabel="幣別與單位"
                onCommit={(v) => {
                  const [currency = 'TWD', unit = 'M'] = String(v).trim().split(/\s+/);
                  patchSettings({ currency, unit });
                }} />
            </div>
          </div>
        </Section>

        <Section title="檢查門檻">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">假設掛載目標比率（CHK-5）</label>
              <NumInput value={s.assumptionTargetRatio ?? 0.8} disabled={disabled} ariaLabel="假設掛載目標比率" onCommit={(v) => patchSettings({ assumptionTargetRatio: Math.max(0, Math.min(1, v || 0.8)) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">複議門檻（極差 ≥，預設 2）</label>
              <NumInput value={s.dispersionThreshold ?? 2} disabled={disabled} ariaLabel="複議門檻" onCommit={(v) => patchSettings({ dispersionThreshold: Math.max(1, Math.min(4, v || 2)) })} />
            </div>
          </div>
        </Section>
      </div>

      <Section title={`成員（${project.memberUids?.length || 0}）`}
        aside={<span className="text-xs text-slate-600">coach 角色由安全規則強制唯讀</span>}>
        <div className="space-y-2">
          {Object.entries(project.members || {}).map(([uid, m]) => (
            <div key={uid} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{m.displayName || m.email || uid}</div>
                <div className="truncate text-xs text-slate-500">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && uid !== ctx.user.uid ? (
                  <>
                    <select
                      value={m.role}
                      aria-label={`${m.displayName || m.email} 的角色`}
                      onChange={(e) => updateMemberRole(project, uid, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                    <Btn kind="ghost" onClick={() => removeMember(project, uid)}>移除</Btn>
                  </>
                ) : (
                  <Chip tone={m.role === 'coach' ? 'idle' : 'brand'}>{ROLES[m.role]?.label || m.role}</Chip>
                )}
              </div>
            </div>
          ))}
        </div>

        {(project.invitedEmails || []).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">待接受邀請</div>
            {(project.invitedEmails || []).map((e) => (
              <div key={e} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                <span>{e} <span className="text-xs text-slate-600">（{ROLES[project.inviteRoles?.[e]]?.label || '成員'}）</span></span>
                {canInvite && <Btn kind="ghost" onClick={() => revokeInvite(project, e)}>撤回</Btn>}
              </div>
            ))}
          </div>
        )}

        {canInvite && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="邀請成員的 Google 帳號 email"
              className="w-64 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <select value={inviteRole} aria-label="邀請角色" onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <Btn kind="primary" onClick={invite}>邀請</Btn>
          </div>
        )}
      </Section>

      <Section title="量測事件（EVT 埋點）">
        <div className="flex flex-wrap items-center gap-3">
          <Btn onClick={async () => {
            const rows = await getSubDocs(project.id, 'events');
            rows.sort((a, b) => (a.at || 0) - (b.at || 0));
            downloadJson(`量測事件_${project.name}.json`, rows);
          }}>
            匯出量測事件 JSON
          </Btn>
          <p className="text-xs leading-relaxed text-slate-500">
            關鍵動作事件（建案／提交評分／短名單／建方案／回頭路徑／檢查／交付）——
            算 KPI（如承接到交付的週期）用這份原始資料。
          </p>
        </div>
      </Section>

      {isOwner && (
        <Section title="危險區">
          <Btn kind="danger" onClick={() => setConfirmDelete(true)}>刪除整個評估專案</Btn>
        </Section>
      )}

      <Modal open={confirmDelete} title="刪除評估專案" onClose={() => setConfirmDelete(false)}>
        <p className="mb-4 text-sm leading-relaxed text-slate-700">
          這會刪除專案「{project.name}」的主文件，所有成員將立即失去存取。此動作無法復原。
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setConfirmDelete(false)}>取消</Btn>
          <Btn kind="danger" onClick={async () => { await deleteProject(project.id); }}>確認刪除</Btn>
        </div>
      </Modal>
    </div>
  );
}

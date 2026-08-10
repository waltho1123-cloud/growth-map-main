import { useProjectStore } from '../../store/useProjectStore';
import { updateProject, setSubDoc, updateSubDoc } from '../../lib/db';
import { DIMENSIONS, DEFAULT_ANCHORS } from '../../domain/criteria';
import { fmtTime } from '../../lib/format';
import { Section, Btn, Chip, TextInput, TextArea } from '../common/ui';

// P-03 評估標準設定：四維定義（BCG 預設不可刪、可加註）＋量表錨點＋輪次＋核定
// 寫入一律走 field-path（criteria.xxx.yyy），不整包覆寫——兩人並行編輯不同錨點
// 不得互相蓋寫（對抗式審查 P2：stale 物件整包 updateDoc 的 lost-update）。
export default function P03Criteria({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const rounds = useProjectStore((s) => s.rounds);
  const criteria = project?.criteria;
  if (!criteria) return null;

  const approved = criteria.approved;
  const disabled = !ctx.editable || approved; // 核定後鎖定；修改需開新輪次
  const canApprove = ctx.editable && (ctx.role === 'owner' || ctx.role === 'facilitator');
  const openRound = rounds.find((r) => r.status === 'open');

  const patchField = (path, value) => updateProject(project.id, { [`criteria.${path}`]: value });

  // 輪次文件以輪次號為 docId（firestore.rules 的 score 規則靠它查輪次狀態）
  const createRound = (n) => setSubDoc(project.id, 'rounds', String(n), {
    n, status: 'open', createdAt: Date.now(), createdBy: ctx.user.uid,
  });

  const approve = async () => {
    await updateProject(project.id, {
      'criteria.approved': true,
      'criteria.approvedBy': ctx.user.uid,
      'criteria.approvedAt': Date.now(),
    });
    if (rounds.length === 0) await createRound(1);
  };

  const newRound = async () => {
    // 開新輪次＝解鎖標準修改；既有輪次關閉、分數保留供比較（P-03 互動規格）
    if (openRound) await updateSubDoc(project.id, 'rounds', openRound.id, { status: 'closed', closedAt: Date.now() });
    await createRound((rounds.at(-1)?.n || 0) + 1);
    await updateProject(project.id, {
      'criteria.approved': false,
      'criteria.approvedBy': null,
      'criteria.approvedAt': null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">評估標準設定</h2>
          <p className="text-xs text-slate-500">四維定義沿用 BCG 原文（不可刪除），可加註本公司語言；預設不加權（PD-01）。</p>
        </div>
        <div className="flex items-center gap-2">
          {approved
            ? <Chip tone="ok">已核定 · {fmtTime(criteria.approvedAt)}</Chip>
            : <Chip tone="warn">未核定</Chip>}
          {canApprove && !approved && <Btn kind="primary" onClick={approve}>核定標準並開啟第 1 輪</Btn>}
          {canApprove && approved && <Btn onClick={newRound}>開新輪次（解鎖修改）</Btn>}
        </div>
      </div>

      {/* 區 1 四維定義卡 */}
      <div className="grid gap-3 md:grid-cols-2">
        {DIMENSIONS.map((d) => (
          <Section key={d.key} title={`${'①②③④'[d.no - 1]} ${d.name}（${d.en}）`}
            aside={<Chip tone="brand">{d.axis === 'y' ? '縱軸' : '橫軸'}</Chip>}>
            <p className="mb-1 text-sm font-medium text-slate-700">{d.oneLiner}</p>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">{d.points}</p>
            <label className="mb-1 block text-xs text-slate-500">本公司加註（選填）</label>
            <TextArea rows={2} disabled={disabled} value={criteria.annotations?.[d.key] || ''} ariaLabel={`${d.name} 本公司加註`}
              onCommit={(v) => patchField(`annotations.${d.key}`, v)}
              placeholder="用自家語言補充這一維在本事業的判讀重點…" />

            {/* 區 2 量表錨點 */}
            <div className="mt-3 space-y-1">
              {[5, 4, 3, 2, 1].map((score) => (
                <div key={score} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-indigo-600">{score}</span>
                  <TextInput disabled={disabled} value={criteria.anchors?.[d.key]?.[score] || ''} ariaLabel={`${d.name} ${score} 分錨點`}
                    onCommit={(v) => patchField(`anchors.${d.key}.${score}`, v)} />
                </div>
              ))}
              {!disabled && (
                <div className="pt-1 text-right">
                  <Btn kind="ghost" onClick={() => patchField(`anchors.${d.key}`, { ...DEFAULT_ANCHORS })}>
                    套用 BCG 預設
                  </Btn>
                </div>
              )}
            </div>
          </Section>
        ))}
      </div>

      {/* 區 3 評分設定 */}
      <Section title="評分設定">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">評分者</div>
            <p className="text-sm leading-relaxed text-slate-700">
              所有非 coach 成員皆可評分（{Object.values(project.members || {}).filter((m) => m.role !== 'coach').length} 人）。
              到「設定與成員」邀請更多評分者。
            </p>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">輪次</div>
            <p className="text-sm text-slate-700">
              {rounds.length === 0 ? '核定標準後自動開啟第 1 輪。' : rounds.map((r) => `第 ${r.n} 輪（${r.status === 'open' ? '進行中' : '已關閉'}）`).join('、')}
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
              加權（PD-01 預設關閉）
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" disabled={disabled} checked={!!criteria.weighting?.enabled}
                onChange={(e) => patchField('weighting.enabled', e.target.checked)} />
              啟用四維加權（啟用需填理由，寫入專案紀錄）
            </label>
            {criteria.weighting?.enabled && (
              <div className="mt-2 space-y-2">
                <TextInput disabled={disabled} value={criteria.weighting?.reason || ''} placeholder="啟用理由（必填）" ariaLabel="加權啟用理由"
                  onCommit={(v) => patchField('weighting.reason', v)} />
                <div className="grid grid-cols-4 gap-1">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key}>
                      <div className="text-center text-[10px] text-slate-500">{d.name.slice(0, 4)}</div>
                      <TextInput disabled={disabled} value={String(criteria.weighting?.weights?.[d.key] ?? 25)} ariaLabel={`${d.name} 權重`}
                        onCommit={(v) => patchField(`weighting.weights.${d.key}`, Number(v) || 0)} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">四維權重總和須為 100。</p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          PD-05：機會若已是進行中的策略方案，系統只「提示」操作潛力可視為滿分，仍需人工點選分數——分數只抓七八成，最後由討論拍板（鐵則 2）。
        </p>
      </Section>
    </div>
  );
}

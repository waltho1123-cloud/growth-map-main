import { useDerived } from '../../hooks/useDerived';
import { useProjectStore } from '../../store/useProjectStore';
import { updateProject } from '../../lib/db';
import { logEvent } from '../../lib/events';
import { navigate } from '../../lib/useHashRoute';
import { fmtTime } from '../../lib/format';
import { Section, Btn, Chip, Lamp } from '../common/ui';

// P-13 綜合檢查：CHK-1～6 逐項卡片＋可否交付橫幅（CHK-1~4 紅燈擋交付）
export default function P13Check({ ctx }) {
  const project = useProjectStore((s) => s.project);
  const { checkRun } = useDerived();

  const record = async () => {
    await updateProject(project.id, { lastCheckRun: checkRun });
    logEvent(project.id, 'check.executed', { // EVT-17
      lamps: Object.fromEntries(checkRun.results.map((r) => [r.code, r.lamp])),
      canDeliver: checkRun.canDeliver,
    }, ctx.user.uid);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">綜合檢查</h2>
          <p className="text-xs text-slate-500">
            檢查為即時計算；「記錄本次結果」會存檔供交付快照與歷史比較。
            {project?.lastCheckRun ? ` 上次記錄：${fmtTime(project.lastCheckRun.ranAt)}` : ''}
          </p>
        </div>
        {ctx.editable && <Btn onClick={record}>記錄本次結果</Btn>}
      </div>

      {/* 頂部橫幅：可否交付 */}
      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        checkRun.canDeliver ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
      }`}>
        {checkRun.canDeliver
          ? '✓ CHK-1～4 全綠——可以進入交付輸出。'
          : `✕ 尚不可交付：${checkRun.blockingFails.join('、')} 未通過（黃燈警示不擋交付，紅燈才擋）。`}
        <Btn kind={checkRun.canDeliver ? 'primary' : 'default'} className="ml-3" onClick={() => navigate('handoff')}>
          前往交付輸出
        </Btn>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {checkRun.results.map((r) => (
          <Section key={r.code}
            title={`${r.code} ${r.title}`}
            aside={
              <div className="flex items-center gap-2">
                {r.blocking && <Chip tone="idle">阻擋項</Chip>}
                <Lamp lamp={r.lamp} />
              </div>
            }>
            <p className="text-sm leading-relaxed text-slate-700">{r.reason}</p>
            {r.lamp !== 'pass' && (
              <div className="mt-2">
                <Btn kind="ghost" onClick={() => navigate(r.goto)}>前往修正 →</Btn>
              </div>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
}

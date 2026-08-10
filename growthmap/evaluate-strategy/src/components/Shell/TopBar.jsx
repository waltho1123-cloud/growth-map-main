import { useProjectStore } from '../../store/useProjectStore';
import { useUiStore } from '../../store/useUiStore';
import { useSyncStatus } from '../../store/useSyncStatus';
import { useDerived } from '../../hooks/useDerived';
import { navigate } from '../../lib/useHashRoute';
import { signOut } from '../../lib/cloud/auth';
import { aiEnabled } from '../../lib/ai';
import { ROLES } from '../../domain/model';
import { Lamp, Chip } from '../common/ui';

// 同其他單元的「頭像＋已同步」膠囊；狀態來自在途寫入計數（useSyncStatus）
function SyncPill({ user }) {
  const pending = useSyncStatus((s) => s.pending);
  const lastError = useSyncStatus((s) => s.lastError);
  const tone = lastError
    ? { text: '同步失敗', cls: 'border-red-200 bg-red-50 text-red-700', dot: '⚠' }
    : pending > 0
      ? { text: '同步中…', cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: '⟳' }
      : { text: '已同步', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: '✓' };
  return (
    <span title={lastError || '雲端寫入狀態'} className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-medium ${tone.cls}`}>
      {user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
          {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>{tone.dot} {tone.text}</span>
    </span>
  );
}

// 頂欄（PRD 7.2.1 區 A）：專案切換 · 達標水位徽章 · CHK 燈號群 · 假設庫 · 使用者
export default function TopBar({ ctx, onExit }) {
  const project = useProjectStore((s) => s.project);
  const openAssumptions = useUiStore((s) => s.openAssumptions);
  const openAi = useUiStore((s) => s.openAi);
  const openComments = useUiStore((s) => s.openComments);
  const { rollup, checkRun } = useDerived();

  const att = rollup.attainmentPct;
  const attTone = att == null ? 'bg-slate-200 text-slate-500'
    : att >= 100 ? 'bg-emerald-100 text-emerald-800'
    : att >= 80 ? 'bg-amber-100 text-amber-800'
    : 'bg-red-100 text-red-700';

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <a href="/" title="返回成長藍圖入口"
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
        <span>←</span>
        <span>返回藍圖</span>
      </a>
      <button type="button" onClick={onExit} title="回專案清單"
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        ⌂ 專案
      </button>
      <div className="hidden shrink-0 leading-tight lg:block">
        <div className="text-sm font-bold tracking-tight text-slate-900">
          {/* 小字版品牌綠用深階 #00804A（5.0:1，AA 小字合格）；大標題版保留 #00A651（大字 3:1 合格） */}
          <span className="text-[#00804A]">BW</span> 成長藍圖實作平台
        </div>
        <div className="text-[11px] leading-none text-slate-500">評估策略 (Evaluate)</div>
      </div>
      <div className="hidden h-7 w-px bg-slate-200 lg:block" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">{project?.name}</div>
        <div className="text-[11px] leading-none text-slate-500 lg:hidden">第四堂 · 評估策略 Evaluate</div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button type="button" onClick={() => navigate('rollup')} title="疊加效益 ÷ 加速增長目標"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${attTone}`}>
          達標 {att == null ? '—' : `${att}%`}
        </button>

        <button type="button" onClick={() => navigate('check')} title="綜合檢查（點擊查看）"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
          {checkRun.results.map((r) => <Lamp key={r.code} lamp={r.lamp} />)}
        </button>

        {aiEnabled && (
          <button type="button" onClick={() => openAi()}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">
            AI 協作
          </button>
        )}
        <button type="button" onClick={() => openAssumptions()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          假設庫
        </button>
        <button type="button" onClick={() => openComments()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          評論
        </button>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <SyncPill user={ctx.user} />
          <Chip tone={ctx.editable ? 'brand' : 'idle'}>{ROLES[ctx.role]?.label || ctx.role}</Chip>
          <button type="button" onClick={() => signOut()} className="text-xs text-slate-500 hover:text-slate-700">登出</button>
        </div>
      </div>
    </header>
  );
}

import React from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { useNav } from '../../contexts/NavContext';
import { BCG_TOOL_LIBRARY, OBSERVATION_TYPE } from '../../utils/toolLibrary';
import { TOOL_ANALYSIS_STATUS } from '../../utils/constants';

const STATUS_META = {
  [TOOL_ANALYSIS_STATUS.COMPLETED]: { label: '已完成', cls: 'bg-emerald-100 text-emerald-700' },
  [TOOL_ANALYSIS_STATUS.IN_PROGRESS]: { label: '進行中', cls: 'bg-amber-100 text-amber-700' },
  [TOOL_ANALYSIS_STATUS.EMPTY]: { label: '未開始', cls: 'bg-gray-100 text-gray-500' },
};

function ToolCard({ tool, enabled, status, onToggle, onOpen }) {
  const meta = STATUS_META[status] || STATUS_META[TOOL_ANALYSIS_STATUS.EMPTY];
  return (
    <div
      onClick={enabled ? onOpen : undefined}
      role={enabled ? 'button' : undefined}
      tabIndex={enabled ? 0 : undefined}
      onKeyDown={enabled ? (e) => {
        if (e.target !== e.currentTarget) return; // 內層啟用切換按鈕的 Enter/Space 交還給按鈕本身
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      } : undefined}
      className={`glass-card rounded-xl p-4 border transition-all ${
        enabled
          ? 'border-emerald-200/70 cursor-pointer hover:shadow-md hover:border-emerald-400'
          : 'border-gray-200/50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-lg bg-gray-700 text-white text-xs font-bold flex items-center justify-center">
            {tool.id}
          </span>
          <span className="font-semibold text-gray-800 text-sm truncate">{tool.name}</span>
        </div>
        {/* 啟用切換 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? '停用' : '啟用'} ${tool.name}`}
          className={`shrink-0 w-10 h-5 rounded-full relative transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{tool.category}</span>
        {enabled && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>}
      </div>
    </div>
  );
}

export default function ToolLibrary() {
  const { state, dispatch } = useOpportunity();
  const { goDashboard, openToolAnalysis } = useNav();
  const { toolActivation } = state.projectMeta;

  const internal = BCG_TOOL_LIBRARY.filter((t) => t.observationType === OBSERVATION_TYPE.INTERNAL);
  const external = BCG_TOOL_LIBRARY.filter((t) => t.observationType === OBSERVATION_TYPE.EXTERNAL);

  const enabledCount = BCG_TOOL_LIBRARY.filter((t) => toolActivation[t.id]).length;
  const completedCount = Object.values(state.toolAnalyses).filter(
    (a) => a?.status === TOOL_ANALYSIS_STATUS.COMPLETED
  ).length;

  const toggle = (code) =>
    dispatch({ type: 'SET_TOOL_ACTIVATION', payload: { code, enabled: !toolActivation[code] } });

  const renderGroup = (title, hint, tools) => (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <span className="text-xs text-gray-400">{hint}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            enabled={!!toolActivation[tool.id]}
            status={state.toolAnalyses[tool.id]?.status}
            onToggle={() => toggle(tool.id)}
            onOpen={() => openToolAnalysis(tool.id)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen">
      <header className="glass-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={goDashboard}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-gray-100 mb-2"
          >
            <span>←</span><span>返回長清單</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">BCG 工具庫</h1>
          <p className="text-gray-500 mt-1 text-sm">
            選擇本期要運用的分析工具 · 已啟用 {enabledCount}／24 · 已完成分析 {completedCount}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="bg-emerald-50/70 border-l-4 border-emerald-400 p-4 rounded-r-lg">
          <p className="text-emerald-800 text-sm">
            本期聚焦<span className="font-semibold">內部洞察工具（17–24）</span>，預設啟用。依「勿煮大海」原則，不需用盡所有工具；點擊已啟用的工具卡即可進入分析。
          </p>
        </div>

        {renderGroup('內部洞察工具', '17–24 · 本期核心', internal)}
        {renderGroup('外部觀察工具', '1–16 · 預留擴充', external)}
      </main>
    </div>
  );
}

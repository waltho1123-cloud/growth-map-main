import React, { useState } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { useNav } from '../../contexts/NavContext';
import { BCG_TOOL_LIBRARY } from '../../utils/toolLibrary';
import { TOOL_ANALYSIS_STATUS } from '../../utils/constants';
import { createEmptyToolAnalysis } from '../../utils/schema';
import DynamicField from './DynamicField';
import { IMETextarea } from '../IMEInput';
import { isAiEnabled, runAiTask } from '../../lib/ai/aiClient';
import AiSuggestionCard from '../ai/AiSuggestionCard';
import { aiText } from '../../lib/ai/aiText';
import toast from 'react-hot-toast';

// 字串列表編輯器（主要洞察 / 機會）
function ListEditor({ title, required, items, onChange, placeholder, accent }) {
  const add = () => onChange([...items, '']);
  const update = (i, v) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const filled = items.filter((s) => s.trim()).length;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">
          {title} {required && <span className="text-red-500">*</span>}
          <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${filled > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
            {filled} 條
          </span>
        </h3>
        <button
          type="button"
          onClick={add}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${accent} `}
        >
          + 新增一條
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-2">尚未填寫，請至少新增一條（方法論鐵則 1：工具的重點是「看到什麼新機會」）。</p>
      )}
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex gap-2 items-start">
            <IMETextarea
              value={val}
              onValueChange={(v) => update(i, v)}
              rows={2}
              placeholder={placeholder}
              className="flex-1 rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="刪除"
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ToolAnalysis() {
  const { state, dispatch } = useOpportunity();
  const { activeToolCode, goToolLibrary } = useNav();
  const tool = BCG_TOOL_LIBRARY.find((t) => t.id === activeToolCode);

  const existing = state.toolAnalyses[activeToolCode] || createEmptyToolAnalysis();
  const [inputs, setInputs] = useState(existing.inputs || {});
  const [insights, setInsights] = useState(existing.insights || []);
  const [opps, setOpps] = useState(existing.opportunitiesNote || []);
  const [status, setStatus] = useState(existing.status);
  const [ai, setAi] = useState({ loading: false, insights: null, confidence: null, error: null });

  if (!tool) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-gray-500">
        找不到工具。
        <button onClick={goToolLibrary} className="ml-2 text-emerald-600 underline">返回工具庫</button>
      </div>
    );
  }

  // 即時持久化（context 內部對 localStorage / 雲端有 debounce）
  const persist = (next, forcedStatus) => {
    const nextStatus =
      forcedStatus || (status === TOOL_ANALYSIS_STATUS.COMPLETED ? TOOL_ANALYSIS_STATUS.COMPLETED : TOOL_ANALYSIS_STATUS.IN_PROGRESS);
    const analysis = {
      inputs: next.inputs ?? inputs,
      insights: next.insights ?? insights,
      opportunitiesNote: next.opps ?? opps,
      status: nextStatus,
      updatedAt: Date.now(),
    };
    dispatch({ type: 'SET_TOOL_ANALYSIS', payload: { code: activeToolCode, analysis } });
    setStatus(nextStatus);
  };

  const setField = (key, val) => {
    const next = { ...inputs, [key]: val };
    setInputs(next);
    persist({ inputs: next });
  };
  const setInsightList = (list) => { setInsights(list); persist({ insights: list }); };
  const setOppList = (list) => { setOpps(list); persist({ opps: list }); };

  const handleComplete = () => {
    const validInsights = insights.filter((s) => s.trim());
    const validOpps = opps.filter((s) => s.trim());
    if (validInsights.length < 1 || validOpps.length < 1) {
      toast.error('需至少填寫 1 條主要洞察與 1 條機會才能標記完成');
      return;
    }
    setInsights(validInsights);
    setOpps(validOpps);
    persist({ insights: validInsights, opps: validOpps }, TOOL_ANALYSIS_STATUS.COMPLETED);
    toast.success(`已完成「${tool.name}」分析`);
  };

  const handleAiInsight = async () => {
    setAi({ loading: true, insights: null, confidence: null, error: null });
    try {
      const r = await runAiTask('AI-01', { toolName: tool.name, inputs });
      setAi({ loading: false, insights: Array.isArray(r.payload?.insights) ? r.payload.insights : [], confidence: r.confidence, error: null });
    } catch (e) {
      setAi({ loading: false, insights: null, confidence: null, error: e.message });
    }
  };
  const acceptAiInsights = () => {
    // 防護：AI 可能回物件而非字串；存入持久化陣列前一律轉安全字串（否則 trim/filter 會 crash）
    setInsightList([...insights, ...(ai.insights || []).map(aiText)]);
    setAi({ loading: false, insights: null, confidence: null, error: null });
    toast.success('已採納 AI 洞察');
  };
  const clearAi = () => setAi({ loading: false, insights: null, confidence: null, error: null });

  const isCompleted = status === TOOL_ANALYSIS_STATUS.COMPLETED;

  return (
    <div className="min-h-screen">
      <header className="glass-header">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={goToolLibrary}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-gray-100 mb-2"
          >
            <span>←</span><span>返回工具庫</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gray-700 text-white text-sm font-bold flex items-center justify-center">{tool.id}</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-800">{tool.name}</h1>
              <p className="text-gray-400 text-xs">{tool.category}{isCompleted && ' · 已完成'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 工具專屬分析欄位（依 fieldSchema 動態渲染） */}
        {tool.fieldSchema.fields.length > 0 ? (
          <div className="glass-card rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-gray-800">工具分析</h3>
            {tool.fieldSchema.fields.map((field) => (
              <DynamicField
                key={field.key}
                field={field}
                value={inputs[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-5 text-sm text-gray-500">
            此工具尚未定義專屬分析欄位（外部觀察工具預留），仍可填寫下方主要洞察與機會。
          </div>
        )}

        {/* AI 洞察生成（AI-01，人在迴路） */}
        {isAiEnabled() && (
          <div>
            <button
              onClick={handleAiInsight}
              disabled={ai.loading}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              ✨ 請 AI 依分析產洞察
            </button>
            {(ai.loading || ai.insights || ai.error) && (
              <AiSuggestionCard
                loading={ai.loading}
                error={ai.error}
                confidence={ai.confidence}
                title="主要洞察候選"
                onAccept={acceptAiInsights}
                onReject={clearAi}
              >
                <ul className="list-disc pl-5 space-y-1">
                  {(ai.insights || []).map((s, i) => <li key={i}>{aiText(s)}</li>)}
                </ul>
              </AiSuggestionCard>
            )}
          </div>
        )}

        {/* 強制：主要洞察 + 機會（FR-02-05 / 鐵則 1） */}
        <ListEditor
          title="主要洞察"
          required
          items={insights}
          onChange={setInsightList}
          placeholder="使用此工具獲得的洞察，幫助打破既有框架…"
          accent="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
        />
        <ListEditor
          title="機會"
          required
          items={opps}
          onChange={setOppList}
          placeholder="由此洞察衍生的增長機會方向…"
          accent="border-amber-300 text-amber-700 hover:bg-amber-50"
        />
      </main>

      <footer className="glass-header sticky bottom-0 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {isCompleted ? '此工具分析已完成，可隨時續編。' : '填寫後標記完成，供增長機會引用。'}
          </span>
          <button
            onClick={handleComplete}
            className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {isCompleted ? '更新完成內容' : '標記完成'}
          </button>
        </div>
      </footer>
    </div>
  );
}

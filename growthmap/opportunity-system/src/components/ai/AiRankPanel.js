import React, { useState } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { isAiEnabled, runAiTask } from '../../lib/ai/aiClient';
import { isShortlisted } from '../../utils/opportunityStatus';
import AiSuggestionCard from './AiSuggestionCard';
import toast from 'react-hot-toast';

// AI-04 機會排序（人在迴路）：AI 建議長清單排序，採納後寫入各機會 rank。
export default function AiRankPanel() {
  const { state, dispatch } = useOpportunity();
  const [ai, setAi] = useState({ loading: false, order: null, rationale: null, error: null });

  const shortlisted = state.opportunities.filter(isShortlisted);
  if (!isAiEnabled() || shortlisted.length < 2) return null;

  const clear = () => setAi({ loading: false, order: null, rationale: null, error: null });

  const run = async () => {
    setAi({ loading: true, order: null, rationale: null, error: null });
    try {
      const r = await runAiTask('AI-04', {
        opportunities: shortlisted.map((o) => ({
          id: o.id,
          title: o.opportunityName,
          ratings: o.template3?.ratings,
          estRevenue: o.estRevenue,
        })),
      });
      setAi({ loading: false, order: Array.isArray(r.payload?.order) ? r.payload.order : [], rationale: r.payload?.rationale, error: null });
    } catch (e) {
      setAi({ loading: false, order: null, rationale: null, error: e.message });
    }
  };

  const accept = () => {
    (ai.order || []).forEach((id, idx) => {
      dispatch({ type: 'UPDATE_OPPORTUNITY', payload: { id, data: { rank: idx + 1 } } });
    });
    clear();
    toast.success('已採納 AI 排序');
  };

  const byId = Object.fromEntries(shortlisted.map((o) => [o.id, o.opportunityName || '未命名']));

  return (
    <div className="pdf-hide">
      <button
        onClick={run}
        disabled={ai.loading}
        className="text-sm font-medium px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
      >
        ✨ 請 AI 建議長清單排序
      </button>
      {(ai.loading || ai.order || ai.error) && (
        <AiSuggestionCard loading={ai.loading} error={ai.error} title="長清單排序" onAccept={accept} onReject={clear}>
          <ol className="list-decimal pl-5 space-y-0.5">
            {(ai.order || []).map((id) => <li key={id}>{byId[id] || id}</li>)}
          </ol>
          {ai.rationale && <p className="text-xs text-gray-600 mt-1">{ai.rationale}</p>}
        </AiSuggestionCard>
      )}
    </div>
  );
}

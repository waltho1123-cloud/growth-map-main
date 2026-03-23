import React, { useState, useCallback } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import TabOne from './TabOne';
import TabTwo from './TabTwo';
import TabThree from './TabThree';
import toast from 'react-hot-toast';

const TABS = [
  { id: 0, label: '模板一', subtitle: '起點與主要洞察' },
  { id: 1, label: '模板二', subtitle: '具體機會展開' },
  { id: 2, label: '模板三', subtitle: '機會初步評估' },
];

export default function OpportunityEditor() {
  const { state, dispatch } = useOpportunity();
  const [activeTab, setActiveTab] = useState(0);

  const opp = state.opportunities.find((o) => o.id === state.editingId);

  // 草稿自動儲存 (debounced)
  const editingId = opp?.id;
  const autoSave = useCallback(
    (updates) => {
      if (!editingId) return;
      dispatch({
        type: 'UPDATE_OPPORTUNITY',
        payload: { id: editingId, data: updates },
      });
    },
    [editingId, dispatch]
  );

  // 防呆驗證
  const validate = () => {
    if (!opp.opportunityName.trim()) {
      toast.error('請填寫增長機會名稱');
      setActiveTab(0);
      return false;
    }

    // 堡壘 + 探索新興市場 的邏輯提醒
    if (
      opp.template1.companyType === '堡壘' &&
      opp.template1.growthLever === '探索新興市場'
    ) {
      toast(
        '系統偵測您自評為堡壘型，但資源投向新興市場，請確認是否符合破框邏輯或有資源偏離現象。',
        {
          icon: '💡',
          duration: 5000,
          style: {
            borderLeft: '4px solid #f59e0b',
            background: '#fffbeb',
          },
        }
      );
    }
    return true;
  };

  const handleSaveAndClose = () => {
    if (!validate()) return;
    toast.success('已儲存增長機會');
    dispatch({ type: 'CLOSE_EDITOR' });
  };

  const handleClose = () => {
    dispatch({ type: 'CLOSE_EDITOR' });
  };

  if (!opp) return null;

  const handleChange = (updates) => {
    autoSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

      {/* Editor Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-4xl glass-card flex flex-col animate-slide-in" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', background: 'rgba(255,255,255,0.72)' }}>
        {/* Header */}
        <div className="glass-header px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {opp.opportunityName || '新增增長機會'}
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              即時自動儲存中
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200/50 bg-white/30 px-4 sm:px-6 shrink-0">
          <nav className="flex space-x-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-700 bg-white/50 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block">{tab.label}</span>
                <span className="block text-xs font-normal mt-0.5 opacity-70">{tab.subtitle}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 0 && <TabOne data={opp} onChange={handleChange} />}
          {activeTab === 1 && <TabTwo data={opp} onChange={handleChange} />}
          {activeTab === 2 && <TabThree data={opp} onChange={handleChange} />}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200/50 px-4 sm:px-6 py-4 bg-white/30 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium glass-card rounded-lg hover:bg-white/60 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSaveAndClose}
            className="px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            儲存並返回清單
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { GROWTH_LEVERS } from '../../utils/constants';

export default function OpportunityTable() {
  const { state, dispatch } = useOpportunity();
  const { opportunities } = state;

  const handleEdit = (id) => dispatch({ type: 'SET_EDITING', payload: id });

  const handleDelete = (id) => {
    if (window.confirm('確定要刪除此增長機會嗎？')) {
      dispatch({ type: 'DELETE_OPPORTUNITY', payload: id });
    }
  };

  // 依據 usedTools 排序分群
  const sorted = [...opportunities].sort((a, b) => {
    const aMin = a.usedTools.length ? Math.min(...a.usedTools) : 99;
    const bMin = b.usedTools.length ? Math.min(...b.usedTools) : 99;
    return aMin - bMin;
  });

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-16 text-navy-400">
        <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium">尚未建立任何增長機會</p>
        <p className="text-sm mt-1">點擊上方「+ 新增增長機會」開始探索</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-navy-200">
        <thead>
          <tr className="bg-navy-800 text-white">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
              BCG 工具 No.
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
              增長機會名稱
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
              成長槓桿
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
              成長面向
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-32">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100 bg-white">
          {sorted.map((opp, idx) => (
            <tr
              key={opp.id}
              className={`hover:bg-navy-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-navy-50/30'}`}
            >
              <td className="px-4 py-3 text-sm">
                <div className="flex flex-wrap gap-1">
                  {opp.usedTools.length > 0
                    ? opp.usedTools.map((toolId) => {
                        return (
                          <span
                            key={toolId}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-navy-100 text-navy-700"
                          >
                            {toolId}
                          </span>
                        );
                      })
                    : <span className="text-navy-300">—</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-navy-900">
                {opp.opportunityName || <span className="text-navy-300 italic">未命名</span>}
              </td>
              <td className="px-4 py-3 text-sm">
                {opp.template1.growthLever ? (
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    opp.template1.growthLever === GROWTH_LEVERS[0]
                      ? 'bg-blue-100 text-blue-800'
                      : opp.template1.growthLever === GROWTH_LEVERS[1]
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {opp.template1.growthLever}
                  </span>
                ) : (
                  <span className="text-navy-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-navy-600">
                {opp.template1.growthDimension || <span className="text-navy-300">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleEdit(opp.id)}
                  className="text-navy-600 hover:text-navy-900 mr-3 text-sm font-medium"
                >
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(opp.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import React from 'react';
import {
  BCG_TOOLS,
  COMPANY_TYPES,
  GROWTH_DIMENSIONS,
  GROWTH_LEVERS,
  GROWTH_TYPES_MAP,
} from '../../utils/constants';
import { IMEInput, IMETextarea } from '../IMEInput';

export default function TabOne({ data, onChange }) {
  const { opportunityName, usedTools, template1 } = data;

  const updateField = (field, value) => {
    onChange({ template1: { ...template1, [field]: value } });
  };

  const handleToolToggle = (toolId) => {
    const next = usedTools.includes(toolId)
      ? usedTools.filter((id) => id !== toolId)
      : [...usedTools, toolId];
    onChange({ usedTools: next });
  };

  const handleGrowthTypeToggle = (type) => {
    const current = template1.growthType || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateField('growthType', next);
  };

  const growthTypeOptions = template1.growthLever
    ? GROWTH_TYPES_MAP[template1.growthLever] || []
    : [];

  return (
    <div className="space-y-6">
      {/* 機會點名稱 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          增長機會名稱 <span className="text-red-500">*</span>
        </label>
        <IMEInput
          type="text"
          value={opportunityName}
          onValueChange={(v) => onChange({ opportunityName: v })}
          placeholder="例如：東南亞植物基飲品市場進入"
          className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
        />
      </div>

      {/* 使用的 BCG 外部工具 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          使用的 BCG 外部分析工具 (可複選)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {BCG_TOOLS.map((tool) => (
            <label
              key={tool.id}
              className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                usedTools.includes(tool.id)
                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-800'
                  : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={usedTools.includes(tool.id)}
                onChange={() => handleToolToggle(tool.id)}
                className="rounded text-emerald-600 focus:ring-emerald-500 mr-2 border-gray-300/60"
              />
              <span className="font-medium mr-1">{tool.id}.</span>
              {tool.name}
            </label>
          ))}
        </div>
      </div>

      {/* 起點評估 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          起點評估 (companyType)
        </label>
        <div className="flex gap-4">
          {COMPANY_TYPES.map((type) => (
            <label
              key={type}
              className={`flex items-center px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                template1.companyType === type
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white/30 border-gray-200/60 text-gray-700 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="companyType"
                value={type}
                checked={template1.companyType === type}
                onChange={() => updateField('companyType', type)}
                className="sr-only"
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* 成長面向 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          成長面向 (growthDimension)
        </label>
        <div className="flex flex-wrap gap-3">
          {GROWTH_DIMENSIONS.map((dim) => (
            <label
              key={dim}
              className={`flex items-center px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                template1.growthDimension === dim
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white/30 border-gray-200/60 text-gray-700 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="growthDimension"
                value={dim}
                checked={template1.growthDimension === dim}
                onChange={() => updateField('growthDimension', dim)}
                className="sr-only"
              />
              {dim}
            </label>
          ))}
        </div>
      </div>

      {/* 成長槓桿 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          成長槓桿 (growthLever)
        </label>
        <div className="flex flex-wrap gap-3">
          {GROWTH_LEVERS.map((lever) => (
            <label
              key={lever}
              className={`flex items-center px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                template1.growthLever === lever
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white/30 border-gray-200/60 text-gray-700 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="growthLever"
                value={lever}
                checked={template1.growthLever === lever}
                onChange={() => {
                  onChange({
                    template1: { ...template1, growthLever: lever, growthType: [] },
                  });
                }}
                className="sr-only"
              />
              {lever}
            </label>
          ))}
        </div>
      </div>

      {/* 成長類型 */}
      {growthTypeOptions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            成長類型 (growthType，可複選)
          </label>
          <div className="flex flex-wrap gap-2">
            {growthTypeOptions.map((type) => (
              <label
                key={type}
                className={`flex items-center px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  (template1.growthType || []).includes(type)
                    ? 'bg-emerald-50/80 border-emerald-400 text-emerald-800'
                    : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={(template1.growthType || []).includes(type)}
                  onChange={() => handleGrowthTypeToggle(type)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 mr-2 border-gray-300/60"
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 主要洞察 */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          主要洞察 (insights)
        </label>
        <IMETextarea
          value={template1.insights}
          onValueChange={(v) => updateField('insights', v)}
          rows={4}
          placeholder="使用工具獲得的洞察，幫助打破既有框架..."
          className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
        />
      </div>
    </div>
  );
}

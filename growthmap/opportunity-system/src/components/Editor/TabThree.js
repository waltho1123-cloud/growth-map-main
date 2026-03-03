import React from 'react';
import { COMPETITIVE_ENVIRONMENTS, CAGR_OPTIONS, EBIT_OPTIONS } from '../../utils/constants';

export default function TabThree({ data, onChange }) {
  const { template3 } = data;

  const updateField = (field, value) => {
    onChange({ template3: { ...template3, [field]: value } });
  };

  return (
    <div className="space-y-8">
      <div className="bg-navy-50 rounded-lg p-4 border border-navy-100">
        <p className="text-sm text-navy-600">
          <span className="font-semibold text-navy-800">模板三：增長機會初步評估</span>
          　—　從四大面向評估此增長機會的可行性與吸引力。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 區塊 1: Size of the prize */}
        <div className="bg-white border border-navy-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-4 flex items-center">
            <span className="w-6 h-6 rounded-full bg-navy-800 text-white text-xs flex items-center justify-center mr-2">1</span>
            Size of the Prize — 市場規模與競爭
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                市場規模 (marketSize)
              </label>
              <input
                type="text"
                value={template3.marketSize}
                onChange={(e) => updateField('marketSize', e.target.value)}
                placeholder="例如：USD 50B (2025)"
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                單位價格 (unitPrice)
              </label>
              <input
                type="text"
                value={template3.unitPrice}
                onChange={(e) => updateField('unitPrice', e.target.value)}
                placeholder="例如：NT$ 150/unit"
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                競爭環境 (competitiveEnvironment)
              </label>
              <select
                value={template3.competitiveEnvironment}
                onChange={(e) => updateField('competitiveEnvironment', e.target.value)}
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              >
                <option value="">請選擇</option>
                {COMPETITIVE_ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                前大品牌市佔率 (topBrandsShare)
              </label>
              <input
                type="text"
                value={template3.topBrandsShare}
                onChange={(e) => updateField('topBrandsShare', e.target.value)}
                placeholder="例如：前3大品牌佔 65%"
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 區塊 2: Potential of play */}
        <div className="bg-white border border-navy-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-4 flex items-center">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center mr-2">2</span>
            Potential of Play — 操作潛力
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                現有規模 (currentScale)
              </label>
              <input
                type="text"
                value={template3.currentScale}
                onChange={(e) => updateField('currentScale', e.target.value)}
                placeholder="例如：年營收 NT$ 2B"
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-2">
                成長潛力 CAGR (cagr)
              </label>
              <div className="flex flex-wrap gap-2">
                {CAGR_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      template3.cagr === opt
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-navy-200 text-navy-600 hover:border-navy-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cagr"
                      value={opt}
                      checked={template3.cagr === opt}
                      onChange={() => updateField('cagr', opt)}
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-2">
                EBIT 利潤率 (ebitMargin)
              </label>
              <div className="flex flex-wrap gap-2">
                {EBIT_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      template3.ebitMargin === opt
                        ? 'bg-navy-700 border-navy-700 text-white'
                        : 'bg-white border-navy-200 text-navy-600 hover:border-navy-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ebitMargin"
                      value={opt}
                      checked={template3.ebitMargin === opt}
                      onChange={() => updateField('ebitMargin', opt)}
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 區塊 3: Path to achieve */}
        <div className="bg-white border border-navy-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-4 flex items-center">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center mr-2">3</span>
            Path to Achieve — 達成路徑
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                必要投資 (requiredInvestment)
              </label>
              <textarea
                value={template3.requiredInvestment}
                onChange={(e) => updateField('requiredInvestment', e.target.value)}
                rows={3}
                placeholder="所需投入的資金、人力、時間等..."
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                潛在障礙 (potentialHurdles)
              </label>
              <textarea
                value={template3.potentialHurdles}
                onChange={(e) => updateField('potentialHurdles', e.target.value)}
                rows={3}
                placeholder="可能遭遇的挑戰與風險..."
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 區塊 4: Right to win */}
        <div className="bg-white border border-navy-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-navy-900 mb-4 flex items-center">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center mr-2">4</span>
            Right to Win — 取勝之道
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                成功因子 (successFactors)
              </label>
              <textarea
                value={template3.successFactors}
                onChange={(e) => updateField('successFactors', e.target.value)}
                rows={3}
                placeholder="在此機會中勝出的關鍵成功因素..."
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-700 mb-1">
                核心能力 (coreCapabilities)
              </label>
              <textarea
                value={template3.coreCapabilities}
                onChange={(e) => updateField('coreCapabilities', e.target.value)}
                rows={3}
                placeholder="公司為何能前進該機會的內部支撐理由..."
                className="w-full rounded-lg border-navy-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

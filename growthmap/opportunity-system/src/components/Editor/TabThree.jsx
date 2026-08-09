import React, { useState } from 'react';
import { COMPETITIVE_ENVIRONMENTS, CAGR_OPTIONS, EBIT_OPTIONS, RATING_MAX, DEFAULT_CURRENCY } from '../../utils/constants';
import { IMEInput, IMETextarea } from '../IMEInput';
import { isAiEnabled, runAiTask } from '../../lib/ai/aiClient';
import AiSuggestionCard from '../ai/AiSuggestionCard';
import { aiLines } from '../../lib/ai/aiText';
import toast from 'react-hot-toast';

const CURRENCIES = ['TWD', 'USD', 'CNY', 'EUR', 'JPY'];

// 1–5 評分燈號（四象限共用）
function RatingDots({ value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="評分">
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} 分`}
          onClick={() => onChange(v === n ? 0 : n)}
          className={`w-7 h-7 rounded-md border text-xs font-semibold transition-colors ${
            v >= n
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white/30 border-gray-200/60 text-gray-400 hover:border-emerald-300'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function QuadrantHeader({ num, color, title, rating, onRating }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2">
      <h3 className="text-sm font-bold text-gray-800 flex items-center min-w-0">
        <span className={`shrink-0 w-6 h-6 rounded-full ${color} text-white text-xs flex items-center justify-center mr-2`}>{num}</span>
        <span className="truncate">{title}</span>
      </h3>
      <RatingDots value={rating} onChange={onRating} />
    </div>
  );
}

export default function TabThree({ data, onChange }) {
  const { template3 } = data;
  const ratings = template3.ratings || { size: 0, potential: 0, path: 0, rightToWin: 0 };

  const updateField = (field, value) => {
    onChange({ template3: { ...template3, [field]: value } });
  };
  const updateRating = (quadrant, value) => {
    onChange({ template3: { ...template3, ratings: { ...ratings, [quadrant]: value } } });
  };

  const [ai, setAi] = useState({ loading: false, payload: null, confidence: null, error: null });
  const clearAi = () => setAi({ loading: false, payload: null, confidence: null, error: null });
  const handleAiScore = async () => {
    setAi({ loading: true, payload: null, confidence: null, error: null });
    try {
      const r = await runAiTask('AI-03', {
        title: data.opportunityName,
        archetype: data.template1?.companyType,
        insights: data.template1?.insights ? [data.template1.insights] : [],
        template2: data.template2,
      });
      setAi({ loading: false, payload: r.payload, confidence: r.confidence, error: null });
    } catch (e) {
      setAi({ loading: false, payload: null, confidence: null, error: e.message });
    }
  };
  const acceptAiScore = () => {
    const p = ai.payload || {};
    const r = p.ratings || {};
    onChange({
      template3: {
        ...template3,
        // 只在 AI 給出有效評分（>0）時覆寫；normalize 對缺漏象限補 0，視為「未評」，不應蓋掉既有評分
        ratings: {
          size: r.size > 0 ? r.size : ratings.size,
          potential: r.potential > 0 ? r.potential : ratings.potential,
          path: r.path > 0 ? r.path : ratings.path,
          rightToWin: r.rightToWin > 0 ? r.rightToWin : ratings.rightToWin,
        },
        ebitBand: p.ebitBand || template3.ebitBand,
        cagrBand: p.cagrBand || template3.cagrBand,
      },
    });
    clearAi();
    toast.success('已採納 AI 評分');
  };

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">模板三：增長機會初步評估</span>
          　—　從四大面向評估，並為每一面向評分（1–5）。評分用於長清單 AI 排序與綜合檢查。
        </p>
      </div>

      {/* AI 評分（AI-03，人在迴路） */}
      {isAiEnabled() && (
        <div>
          <button
            onClick={handleAiScore}
            disabled={ai.loading}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            ✨ 請 AI 評四象限分數
          </button>
          {(ai.loading || ai.payload || ai.error) && (
            <AiSuggestionCard
              loading={ai.loading}
              error={ai.error}
              confidence={ai.confidence}
              title="四象限評分"
              onAccept={acceptAiScore}
              onReject={clearAi}
            >
              <div className="font-medium">
                Size {ai.payload?.ratings?.size} · Potential {ai.payload?.ratings?.potential} · Path {ai.payload?.ratings?.path} · Right to Win {ai.payload?.ratings?.rightToWin}
              </div>
              <div className="text-xs text-gray-500">EBIT {typeof ai.payload?.ebitBand === 'string' ? ai.payload.ebitBand : '—'} · CAGR {typeof ai.payload?.cagrBand === 'string' ? ai.payload.cagrBand : '—'}</div>
              {ai.payload?.rationale && (
                <div className="text-xs mt-1 text-gray-600 space-y-0.5">
                  {aiLines(ai.payload.rationale).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </AiSuggestionCard>
          )}
        </div>
      )}

      {/* 預估營收貢獻（供 CHK-1） */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">預估營收貢獻 <span className="text-xs font-normal text-gray-400">（供綜合檢查 CHK-1：機會營收總和 ≥ 成長差距 × 緩衝係數）</span></h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="t3-f1" className="block text-xs font-medium text-gray-600 mb-1">預估年營收</label>
            <input id="t3-f1"
              type="number"
              min="0"
              inputMode="numeric"
              value={data.estRevenue ? data.estRevenue : ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ estRevenue: v === '' ? 0 : Math.max(0, Number(v) || 0) });
              }}
              placeholder="例如 5000000"
              className="w-48 rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            />
          </div>
          <div>
            <label htmlFor="t3-f2" className="block text-xs font-medium text-gray-600 mb-1">幣別</label>
            <select id="t3-f2"
              value={data.currency || DEFAULT_CURRENCY}
              onChange={(e) => onChange({ currency: e.target.value })}
              className="rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 區塊 1: Size of the prize */}
        <div className="glass-card rounded-xl p-5">
          <QuadrantHeader num={1} color="bg-gray-700" title="Size of the Prize — 市場規模與競爭" rating={ratings.size} onRating={(v) => updateRating('size', v)} />
          <div className="space-y-4">
            <div>
              <label htmlFor="t3-f3" className="block text-xs font-medium text-gray-600 mb-1">市場規模 (marketSize)</label>
              <IMEInput id="t3-f3" type="text" value={template3.marketSize} onValueChange={(v) => updateField('marketSize', v)} placeholder="例如：USD 50B (2025)" className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label htmlFor="t3-f4" className="block text-xs font-medium text-gray-600 mb-1">單位價格 (unitPrice)</label>
              <IMEInput id="t3-f4" type="text" value={template3.unitPrice} onValueChange={(v) => updateField('unitPrice', v)} placeholder="例如：NT$ 150/unit" className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label htmlFor="t3-f5" className="block text-xs font-medium text-gray-600 mb-1">競爭環境 (competitiveEnvironment)</label>
              <select id="t3-f5" value={template3.competitiveEnvironment} onChange={(e) => updateField('competitiveEnvironment', e.target.value)} className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm">
                <option value="">請選擇</option>
                {COMPETITIVE_ENVIRONMENTS.map((env) => <option key={env} value={env}>{env}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t3-f6" className="block text-xs font-medium text-gray-600 mb-1">前大品牌市佔率 (topBrandsShare)</label>
              <IMEInput id="t3-f6" type="text" value={template3.topBrandsShare} onValueChange={(v) => updateField('topBrandsShare', v)} placeholder="例如：前3大品牌佔 65%" className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
        </div>

        {/* 區塊 2: Potential of play */}
        <div className="glass-card rounded-xl p-5">
          <QuadrantHeader num={2} color="bg-emerald-600" title="Potential of Play — 操作潛力" rating={ratings.potential} onRating={(v) => updateRating('potential', v)} />
          <div className="space-y-4">
            <div>
              <label htmlFor="t3-f7" className="block text-xs font-medium text-gray-600 mb-1">現有規模 (currentScale)</label>
              <IMEInput id="t3-f7" type="text" value={template3.currentScale} onValueChange={(v) => updateField('currentScale', v)} placeholder="例如：年營收 NT$ 2B" className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <div className="block text-xs font-medium text-gray-600 mb-2">成長潛力 CAGR (cagr)</div>
              <div className="flex flex-wrap gap-2">
                {CAGR_OPTIONS.map((opt) => (
                  <label key={opt} className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${template3.cagr === opt ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-400'}`}>
                    <input type="radio" name="cagr" value={opt} checked={template3.cagr === opt} onChange={() => updateField('cagr', opt)} className="sr-only" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="block text-xs font-medium text-gray-600 mb-2">EBIT 利潤率 (ebitMargin)</div>
              <div className="flex flex-wrap gap-2">
                {EBIT_OPTIONS.map((opt) => (
                  <label key={opt} className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${template3.ebitMargin === opt ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-400'}`}>
                    <input type="radio" name="ebitMargin" value={opt} checked={template3.ebitMargin === opt} onChange={() => updateField('ebitMargin', opt)} className="sr-only" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 區塊 3: Path to achieve */}
        <div className="glass-card rounded-xl p-5">
          <QuadrantHeader num={3} color="bg-amber-500" title="Path to Achieve — 達成路徑" rating={ratings.path} onRating={(v) => updateRating('path', v)} />
          <div className="space-y-4">
            <div>
              <label htmlFor="t3-f10" className="block text-xs font-medium text-gray-600 mb-1">必要投資 (requiredInvestment)</label>
              <IMETextarea id="t3-f10" value={template3.requiredInvestment} onValueChange={(v) => updateField('requiredInvestment', v)} rows={3} placeholder="所需投入的資金、人力、時間等..." className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label htmlFor="t3-f11" className="block text-xs font-medium text-gray-600 mb-1">潛在障礙 (potentialHurdles)</label>
              <IMETextarea id="t3-f11" value={template3.potentialHurdles} onValueChange={(v) => updateField('potentialHurdles', v)} rows={3} placeholder="可能遭遇的挑戰與風險..." className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
        </div>

        {/* 區塊 4: Right to win */}
        <div className="glass-card rounded-xl p-5">
          <QuadrantHeader num={4} color="bg-purple-600" title="Right to Win — 取勝之道" rating={ratings.rightToWin} onRating={(v) => updateRating('rightToWin', v)} />
          <div className="space-y-4">
            <div>
              <label htmlFor="t3-f12" className="block text-xs font-medium text-gray-600 mb-1">成功因子 (successFactors)</label>
              <IMETextarea id="t3-f12" value={template3.successFactors} onValueChange={(v) => updateField('successFactors', v)} rows={3} placeholder="在此機會中勝出的關鍵成功因素..." className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label htmlFor="t3-f13" className="block text-xs font-medium text-gray-600 mb-1">核心能力 (coreCapabilities)</label>
              <IMETextarea id="t3-f13" value={template3.coreCapabilities} onValueChange={(v) => updateField('coreCapabilities', v)} rows={3} placeholder="公司為何能前進該機會的內部支撐理由..." className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

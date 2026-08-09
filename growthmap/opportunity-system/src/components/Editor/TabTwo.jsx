import React from 'react';
import { IMETextarea } from '../IMEInput';
import { GO_TO_MARKET_FACETS } from '../../utils/constants';

const textareaCls = 'w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm';

function Field({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
      <IMETextarea
        value={value || ''}
        onValueChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className={textareaCls}
      />
    </div>
  );
}

export default function TabTwo({ data, onChange }) {
  const { template2 } = data;
  const gtm = template2.goToMarket || {};

  const updateField = (field, value) => {
    onChange({ template2: { ...template2, [field]: value } });
  };
  const updateGtm = (facet, value) => {
    onChange({ template2: { ...template2, goToMarket: { ...gtm, [facet]: value } } });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">模板二：具體機會展開</span>
          　—　描述增長機會的理念、目標客戶、市場進入策略（七面向）、獨特賣點與實施步驟。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="增長機會理念 (concept)" value={template2.concept} onChange={(v) => updateField('concept', v)} placeholder="這個增長機會的核心理念…" />
        <Field label="增長方法 (method)" value={template2.method} onChange={(v) => updateField('method', v)} placeholder="主要透過什麼方式達成此機會…" />
      </div>

      <Field label="目標客戶 (targetCustomer)" value={template2.targetCustomer} onChange={(v) => updateField('targetCustomer', v)} placeholder="目標客群篩選維度、客群畫像 Persona：是誰？特點？偏好？消費行為與決策模式…" rows={4} />
      <Field label="獨特賣點 (usp)" value={template2.usp} onChange={(v) => updateField('usp', v)} placeholder="產品價值主張、品牌優勢：與競品的差異化、核心價值主張…" rows={4} />

      {/* 市場進入策略 — 七面向（SDD Template2.goToMarket） */}
      <div>
        <div className="block text-sm font-semibold text-gray-600 mb-2">市場進入策略（七面向）</div>
        {template2.goToMarketStrategy ? (
          <div className="mb-3 bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <span className="font-semibold">舊版進入策略內容（供參考，可搬移至下方各面向）：</span>
            <p className="mt-1 whitespace-pre-wrap">{template2.goToMarketStrategy}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GO_TO_MARKET_FACETS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`t2-gtm-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <IMETextarea id={`t2-gtm-${f.key}`} value={gtm[f.key] || ''} onValueChange={(v) => updateGtm(f.key, v)} rows={2} className={textareaCls} />
            </div>
          ))}
        </div>
      </div>

      <Field label="實施步驟 (steps)" value={template2.steps} onChange={(v) => updateField('steps', v)} placeholder="執行策略的關鍵活動：短期行動計畫、里程碑與關鍵決策點…" rows={4} />
    </div>
  );
}

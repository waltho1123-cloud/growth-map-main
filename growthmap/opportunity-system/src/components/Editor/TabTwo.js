import React from 'react';
import { IMETextarea } from '../IMEInput';

export default function TabTwo({ data, onChange }) {
  const { template2 } = data;

  const updateField = (field, value) => {
    onChange({ template2: { ...template2, [field]: value } });
  };

  const fields = [
    {
      key: 'targetCustomer',
      label: '目標客戶 (targetCustomer)',
      placeholder: '目標客群篩選維度、客群畫像 Persona：\n• 是誰？特點？偏好？\n• 消費行為與決策模式',
      rows: 4,
    },
    {
      key: 'usp',
      label: '獨特賣點 (usp)',
      placeholder: '產品價值主張、品牌優勢：\n• 與競品的差異化\n• 核心價值主張',
      rows: 4,
    },
    {
      key: 'goToMarketStrategy',
      label: '市場進入策略 (goToMarketStrategy)',
      placeholder: '研發、生產、定價、行銷、通路、物流等：\n• 如何到達目標客戶？\n• 關鍵通路與定價策略',
      rows: 4,
    },
    {
      key: 'implementationSteps',
      label: '實施步驟 (implementationSteps)',
      placeholder: '執行策略的關鍵活動：\n• 短期行動計畫\n• 里程碑與關鍵決策點',
      rows: 4,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">模板二：具體機會展開</span>
          　—　請詳細描述此增長機會的目標客戶、獨特賣點、市場進入策略與實施步驟。
        </p>
      </div>

      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-semibold text-gray-600 mb-1">
            {field.label}
          </label>
          <IMETextarea
            value={template2[field.key]}
            onValueChange={(v) => updateField(field.key, v)}
            rows={field.rows}
            placeholder={field.placeholder}
            className="w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { IMEInput, IMETextarea } from '../IMEInput';
import { RATING_MAX } from '../../utils/constants';

// 依 fieldSchema 的 field.type 動態渲染表單控制項（資料驅動，MOD-02）。
const inputCls =
  'w-full rounded-lg neu-input focus:border-emerald-500 focus:ring-emerald-500 text-sm';

export default function DynamicField({ field, value, onChange }) {
  const { label, type, options = [], placeholder } = field;

  const renderControl = () => {
    switch (type) {
      case 'textarea':
        return (
          <IMETextarea
            value={value || ''}
            onValueChange={onChange}
            rows={3}
            placeholder={placeholder}
            className={inputCls}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={placeholder}
            className={inputCls}
          />
        );

      case 'select':
        return (
          <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
            <option value="">請選擇</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label
                key={o}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                  value === o
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-400'
                }`}
              >
                <input type="radio" checked={value === o} onChange={() => onChange(o)} className="sr-only" />
                {o}
              </label>
            ))}
          </div>
        );

      case 'multiselect': {
        const arr = Array.isArray(value) ? value : [];
        const toggle = (o) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label
                key={o}
                className={`flex items-center px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                  arr.includes(o)
                    ? 'bg-emerald-50/80 border-emerald-400 text-emerald-800'
                    : 'bg-white/30 border-gray-200/60 text-gray-600 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={arr.includes(o)}
                  onChange={() => toggle(o)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 mr-1.5 border-gray-300/60"
                />
                {o}
              </label>
            ))}
          </div>
        );
      }

      case 'rating': {
        const v = Number(value) || 0;
        return (
          <div className="flex gap-1.5">
            {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(v === n ? 0 : n)}
                className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-colors ${
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

      case 'text':
      default:
        return (
          <IMEInput
            type="text"
            value={value || ''}
            onValueChange={onChange}
            placeholder={placeholder}
            className={inputCls}
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-1.5">{label}</label>
      {renderControl()}
    </div>
  );
}

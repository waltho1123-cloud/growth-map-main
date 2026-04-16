const COLUMN_HEADERS = [
  { key: 'category', label: '增長維度', width: 'w-36' },
  { key: 'marketSize2028', label: '2028 市場規模 (億)', width: 'w-40' },
  { key: 'marketShare2028', label: '2028 市佔率 (%)', width: 'w-36' },
  { key: 'revenue2028', label: '2028 營業收入 (億)', width: 'w-40' },
  { key: 'description', label: '說明', width: 'flex-1' },
]

import { IMEInput } from './IMEInput';
import { NumericInput } from './NumericInput';

const CATEGORY_ICONS = {
  core: '📊',
  newProd: '🚀',
  newMarket: '🌍',
  newModel: '💡',
}

export default function AnsoffTable({ data, onChange }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200/60">
            {COLUMN_HEADERS.map((col) => (
              <th
                key={col.key}
                className={`text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/80 ${col.width}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id}
              className={`border-b border-gray-200/40 ${idx % 2 === 0 ? 'bg-white/20' : 'bg-white/10'}`}
            >
              {/* 維度名稱 */}
              <td className="py-3 px-3 font-medium text-gray-700">
                <span className="mr-1.5">{CATEGORY_ICONS[row.id]}</span>
                {row.category}
              </td>

              {/* 市場規模 */}
              <td className="py-3 px-3">
                <NumericInput
                  value={row.marketSize2028}
                  onValueChange={(n) => onChange(idx, 'marketSize2028', n)}
                  className="neu-input w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                  placeholder="0"
                />
              </td>

              {/* 市佔率 */}
              <td className="py-3 px-3">
                <div className="relative">
                  <NumericInput
                    value={row.marketShare2028}
                    onValueChange={(n) => onChange(idx, 'marketShare2028', n)}
                    className="neu-input w-full rounded px-2 pr-8 py-1.5 text-sm focus:outline-none"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                </div>
              </td>

              {/* 營業收入（自動計算） */}
              <td className="py-3 px-3">
                <div className="bg-bg-highlight border border-brand-blue-light/20 rounded px-2 py-1.5 text-sm font-semibold text-brand-blue text-right">
                  {row.revenue2028 > 0
                    ? row.revenue2028.toLocaleString('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : '—'}
                </div>
              </td>

              {/* 說明 */}
              <td className="py-3 px-3">
                <IMEInput
                  type="text"
                  value={row.description}
                  onValueChange={(v) => onChange(idx, 'description', v)}
                  className="neu-input w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                  placeholder="策略說明..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

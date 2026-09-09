import { IMEInput } from './IMEInput';
import { NumericInput } from './NumericInput';
import {
  ANSOFF_TAGS,
  BUSINESS_MODEL_OPTIONS,
  SHARE_THRESHOLD,
  effectiveBusinessModel,
  shareWarning,
} from '../lib/marketLayers';

// ② 落地：TAM 依產品／市場 既有／新 分到四格（p34），每列再標原有／新商業模式（p30、p37），市佔率有 20% 門檻（p31–32）
const COLUMN_HEADERS = [
  { key: 'category', label: '增長維度（產品 × 市場）', width: 'w-44' },
  { key: 'businessModel', label: '商業模式', width: 'w-32' },
  { key: 'marketSize2028', label: '2028 市場規模 (億)', width: 'w-36' },
  { key: 'marketShare2028', label: `2028 市佔率 (%)・門檻 ${SHARE_THRESHOLD}%`, width: 'w-40' },
  { key: 'revenue2028', label: '2028 營業收入 (億)', width: 'w-36' },
  { key: 'description', label: '說明（TAM 在此如何呈現）', width: 'flex-1' },
]

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
          {data.map((row, idx) => {
            const tag = ANSOFF_TAGS[row.id]
            const bm = effectiveBusinessModel(row)
            const fixedModel = row.id === 'newModel'
            const warn = shareWarning(row.marketShare2028)
            return (
              <tr
                key={row.id}
                className={`border-b border-gray-200/40 ${idx % 2 === 0 ? 'bg-white/20' : 'bg-white/10'}`}
              >
                {/* 維度名稱＋既有／新 標記 */}
                <td className="py-3 px-3 font-medium text-gray-700 align-top">
                  <div>
                    <span className="mr-1.5">{CATEGORY_ICONS[row.id]}</span>
                    {row.category}
                  </div>
                  {tag && (
                    <div className="text-[11px] font-normal text-gray-400 mt-0.5">
                      {tag.product} × {tag.market}
                    </div>
                  )}
                </td>

                {/* 原有／新商業模式 */}
                <td className="py-3 px-3 align-top">
                  <div className="inline-flex rounded-md overflow-hidden border border-gray-200/70" role="group" aria-label={`${row.category} 商業模式`}>
                    {BUSINESS_MODEL_OPTIONS.map((opt) => {
                      const active = bm === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={fixedModel}
                          title={opt.label}
                          aria-pressed={active}
                          onClick={() => onChange(idx, 'businessModel', opt.value)}
                          className={`px-2.5 py-1 text-xs transition-colors ${
                            active ? 'bg-brand-blue text-white' : 'bg-white/40 text-gray-600 hover:bg-white/80'
                          } ${fixedModel ? 'cursor-not-allowed' : ''}`}
                        >
                          {opt.short}
                        </button>
                      )
                    })}
                  </div>
                  {fixedModel && <div className="text-[11px] text-gray-400 mt-0.5">此列固定為新商業模式</div>}
                </td>

                {/* 市場規模 */}
                <td className="py-3 px-3 align-top">
                  <NumericInput
                    value={row.marketSize2028}
                    onValueChange={(n) => onChange(idx, 'marketSize2028', n)}
                    className="neu-input w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                    placeholder="0"
                  />
                </td>

                {/* 市佔率＋20% 門檻提醒 */}
                <td className="py-3 px-3 align-top">
                  <div className="relative">
                    <NumericInput
                      value={row.marketShare2028}
                      onValueChange={(n) => onChange(idx, 'marketShare2028', n)}
                      className={`neu-input w-full rounded px-2 pr-8 py-1.5 text-sm focus:outline-none ${warn ? 'border-amber-400' : ''}`}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                  </div>
                  {warn && <p className="text-[11px] text-amber-600 mt-1 leading-snug">⚠ {warn}</p>}
                </td>

                {/* 營業收入（自動計算） */}
                <td className="py-3 px-3 align-top">
                  <div className="bg-bg-highlight border border-brand-blue-light/20 rounded px-2 py-1.5 text-sm font-semibold text-brand-blue text-right">
                    {row.revenue2028 > 0
                      ? row.revenue2028.toLocaleString('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      : '—'}
                  </div>
                </td>

                {/* 說明 */}
                <td className="py-3 px-3 align-top">
                  <IMEInput
                    type="text"
                    value={row.description}
                    onValueChange={(v) => onChange(idx, 'description', v)}
                    className="neu-input w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                    placeholder="這個 TAM 在此格以什麼產品／市場呈現？愈具體愈好（客戶別、產品別）"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

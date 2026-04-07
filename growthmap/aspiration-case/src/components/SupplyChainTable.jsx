import { IMETextarea } from './IMEInput';

const BOTTLENECK_LABELS = {
  procurement: '採購',
  manufacturing: '製造',
  logistics: '物流',
  tech: '技術',
}

const CATEGORY_LABELS = {
  core: '既有市場/產品',
  newProd: '新產品/服務',
  newMarket: '新市場/客戶',
  newModel: '新商業模式',
}

export default function SupplyChainTable({ data, categories, activeCategories, onChange }) {
  return (
    <div className="space-y-4">
      {data.map((item, idx) => {
        const isActive = activeCategories.has(item.categoryId)
        const matchedCategory = categories.find(c => c.id === item.categoryId)
        const revenueValue = matchedCategory?.revenue2028 || 0

        return (
          <div
            key={item.categoryId}
            className={`glass-card rounded-xl p-4 transition-colors ${
              isActive
                ? 'border-brand-green/40 bg-emerald-50/20'
                : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                {CATEGORY_LABELS[item.categoryId]}
              </h4>
              {isActive && (
                <span className="text-xs bg-emerald-100/60 text-brand-green px-2 py-0.5 rounded-full font-medium">
                  營收 {revenueValue.toFixed(1)} 億 — 請評估供應鏈
                </span>
              )}
              {!isActive && (
                <span className="text-xs text-gray-400">尚無預估營收</span>
              )}
            </div>

            {/* 瓶頸 Checkboxes */}
            <div className="flex flex-wrap gap-4 mb-3">
              {Object.entries(BOTTLENECK_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.bottlenecks[key]}
                    onChange={(e) => onChange(idx, key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300/60 text-brand-blue focus:ring-brand-blue-light/40"
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* 突破方案 */}
            <IMETextarea
              value={item.breakthrough}
              onValueChange={(v) => onChange(idx, 'breakthrough', v)}
              rows={2}
              className="neu-input w-full rounded-md px-3 py-2 text-sm resize-y focus:outline-none"
              placeholder="如何突破瓶頸？請描述解決方案..."
            />
          </div>
        )
      })}
    </div>
  )
}

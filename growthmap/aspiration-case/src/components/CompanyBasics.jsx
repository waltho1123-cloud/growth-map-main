function NumericInput({ label, value, onChange, unit = '', highlight = false }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-light/40 focus:border-brand-blue-light ${
            highlight
              ? 'border-brand-green bg-emerald-50 font-semibold text-brand-green'
              : 'border-border-dark'
          }`}
          placeholder="0"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function CagrBadge({ label, value, color }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${color}`}>
      <span>{label}</span>
      <span className="font-bold">{value > 0 ? `${value.toFixed(1)}%` : '—'}</span>
    </div>
  )
}

export default function CompanyBasics({ data, naturalCAGR, aspirationCAGR, onChange }) {
  return (
    <div className="space-y-6">
      {/* 公司名稱 + 基準營收 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">公司名稱</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            className="border border-border-dark rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-light/40 focus:border-brand-blue-light"
            placeholder="請輸入公司名稱"
          />
        </div>
        <NumericInput
          label="2025 年營收（基準）"
          value={data.revenue2025}
          onChange={(v) => onChange('revenue2025', v)}
          unit="億"
        />
      </div>

      {/* 自然增長 vs 加速增長 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 自然增長 */}
        <div className="border border-border rounded-lg p-4 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            自然增長情境 (Momentum Case)
          </h3>
          <NumericInput
            label="2028 目標營收"
            value={data.naturalGrowth.targetRevenue2028}
            onChange={(v) => onChange('naturalGrowth.targetRevenue2028', v)}
            unit="億"
          />
          <div className="mt-3">
            <CagrBadge
              label="CAGR"
              value={naturalCAGR}
              color="bg-gray-100 text-gray-700"
            />
          </div>
        </div>

        {/* 加速增長 */}
        <div className="border-2 border-brand-green rounded-lg p-4 bg-emerald-50/30">
          <h3 className="text-sm font-semibold text-brand-green mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            加速增長情境 (Aspiration Case)
          </h3>
          <NumericInput
            label="2028 最終拍板營收目標"
            value={data.aspirationGrowth.targetRevenue2028}
            onChange={(v) => onChange('aspirationGrowth.targetRevenue2028', v)}
            unit="億"
            highlight
          />
          <div className="mt-3">
            <CagrBadge
              label="CAGR"
              value={aspirationCAGR}
              color="bg-emerald-100 text-brand-green"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

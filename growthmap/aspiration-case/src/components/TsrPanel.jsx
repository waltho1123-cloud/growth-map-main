function FieldGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function NumberField({ value, onChange, unit = '', placeholder = '0' }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full border border-border-dark rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-light/40 focus:border-brand-blue-light ${unit ? 'pr-10' : ''}`}
        placeholder={placeholder}
        step="0.1"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{unit}</span>
      )}
    </div>
  )
}

export default function TsrPanel({ data, onChange }) {
  return (
    <div className="space-y-6">
      {/* 提示 */}
      <div className="bg-bg-warning border border-amber-300 rounded-md px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        假設未來三年不發股利
      </div>

      {/* TSR 目標 */}
      <div className="max-w-xs">
        <FieldGroup label="股東要求三年 TSR (%)">
          <NumberField
            value={data.targetTsr3Years}
            onChange={(v) => onChange(null, 'targetTsr3Years', v)}
            unit="%"
          />
        </FieldGroup>
      </div>

      {/* 貢獻度拆解 + 2028 目標 並排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 貢獻度拆解 */}
        <div className="border border-border rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">TSR 貢獻度拆解</h4>
          <div className="space-y-3">
            <FieldGroup label="營收增長 (%)">
              <NumberField
                value={data.contributions.revenueGrowth}
                onChange={(v) => onChange('contributions', 'revenueGrowth', v)}
                unit="%"
              />
            </FieldGroup>
            <FieldGroup label="EBIT 增長 (%)">
              <NumberField
                value={data.contributions.ebitGrowth}
                onChange={(v) => onChange('contributions', 'ebitGrowth', v)}
                unit="%"
              />
            </FieldGroup>
            <FieldGroup label="EBIT 倍數提升">
              <NumberField
                value={data.contributions.ebitMultiple}
                onChange={(v) => onChange('contributions', 'ebitMultiple', v)}
                unit="+X.X"
              />
            </FieldGroup>
          </div>
        </div>

        {/* 2028 財務目標 */}
        <div className="border border-border rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">2028 財務目標</h4>
          <div className="space-y-3">
            <FieldGroup label="2028 營收 (億)">
              <NumberField
                value={data.targets2028.revenue}
                onChange={(v) => onChange('targets2028', 'revenue', v)}
                unit="億"
              />
            </FieldGroup>
            <FieldGroup label="2028 EBIT 利潤率 (%)">
              <NumberField
                value={data.targets2028.ebitMargin}
                onChange={(v) => onChange('targets2028', 'ebitMargin', v)}
                unit="%"
              />
            </FieldGroup>
            <FieldGroup label="2028 EBIT 倍數">
              <NumberField
                value={data.targets2028.ebitMultiple}
                onChange={(v) => onChange('targets2028', 'ebitMultiple', v)}
                unit="X"
              />
            </FieldGroup>
          </div>
        </div>
      </div>
    </div>
  )
}

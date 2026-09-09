import { IMETextarea } from './IMEInput'
import { NumericInput } from './NumericInput'
import { MARKET_LAYERS, marketLayerWarnings, pctOf } from '../lib/marketLayers'

const fmt = (n) => Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 1 })

// ① 破框：TAM／SAM／SOM 三層市場（講義 p21–27）。先文字描述再估規模；一致性提醒見 lib/marketLayers.js
export default function MarketLayersPanel({ data, onChange }) {
  const layers = data || {}
  const warnings = marketLayerWarnings(layers)
  const sizes = MARKET_LAYERS.map((l) => Number((layers[l.key] || {}).size) || 0)
  const hasFunnel = sizes.every((v) => v > 0)

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700">① 破框：TAM／SAM／SOM 三層市場</h3>
        <p className="text-xs text-gray-500 mt-1">
          先用文字描述再估規模（p24）；資料不足可用「現況的幾倍」描述。最容易犯的錯誤是把 SAM 當成 TAM——請從「產品／服務究竟滿足哪種需求」來思考 TAM（p21–22）。
          破框提示：換一個 CEO 視角（工具 24）、看不同顧客群（即將成為／拒絕／未開發的非顧客）、分存量與增量（p25–27）。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MARKET_LAYERS.map((l) => {
          const v = layers[l.key] || {}
          return (
            <div key={l.key} className="border border-white/40 rounded-lg p-4 bg-white/30 flex flex-col gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-700">
                  {l.code} <span className="font-normal text-gray-500">{l.name}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{l.hint}</div>
              </div>
              <label htmlFor={`ml-${l.key}-desc`} className="text-xs font-medium text-gray-500">文字描述</label>
              <IMETextarea
                id={`ml-${l.key}-desc`}
                value={v.description || ''}
                onValueChange={(t) => onChange(l.key, 'description', t)}
                rows={3}
                placeholder={l.placeholder}
                className="neu-input w-full rounded-md px-3 py-2 text-sm focus:outline-none"
              />
              <label htmlFor={`ml-${l.key}-size`} className="text-xs font-medium text-gray-500">規模</label>
              <div className="relative">
                <NumericInput
                  id={`ml-${l.key}-size`}
                  value={v.size || 0}
                  onValueChange={(n) => onChange(l.key, 'size', n)}
                  className="neu-input w-full rounded-md px-3 py-2 text-sm focus:outline-none"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">億</span>
              </div>
            </div>
          )
        })}
      </div>

      {hasFunnel && (
        <p className="mt-3 px-1 text-xs text-gray-600">
          TAM {fmt(sizes[0])} 億 → SAM {fmt(sizes[1])} 億（占 TAM {pctOf(sizes[1], sizes[0])}）→ SOM {fmt(sizes[2])} 億（占 SAM {pctOf(sizes[2], sizes[1])}）
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 px-1">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-amber-600">⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

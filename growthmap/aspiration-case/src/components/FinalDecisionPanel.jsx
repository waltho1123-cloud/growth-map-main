import { NumericInput } from './NumericInput';

export default function FinalDecisionPanel({ partASubtotal, partBRevenue, aspirationRevenue, onFinalDecision }) {
  const formatNum = (n) =>
    n > 0 ? n.toLocaleString('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'

  return (
    <section className="glass-card border-2 border-brand-green/40 rounded-2xl overflow-hidden">
      <div className="bg-emerald-50/40 backdrop-blur-sm border-b border-brand-green/20 px-6 py-3 flex items-center gap-3">
        <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-base font-semibold text-brand-green">
          CEO 最終拍板：加速增長目標
        </h2>
      </div>

      <div className="px-6 py-5">
        <p className="text-sm text-gray-500 mb-4">
          綜合「客戶/市場視角」與「股東視角」兩大參考數字，請決定最終的 2028 加速增長營收目標。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 客戶視角 */}
          <div className="border border-white/40 rounded-lg p-4 text-center bg-white/40">
            <div className="text-xs font-medium text-gray-500 mb-1">A. 客戶視角營收加總</div>
            <div className="text-2xl font-bold text-brand-blue">{formatNum(partASubtotal)}</div>
            <div className="text-xs text-gray-400 mt-1">億 (Market View)</div>
          </div>

          {/* 股東視角 */}
          <div className="border border-white/40 rounded-lg p-4 text-center bg-white/40">
            <div className="text-xs font-medium text-gray-500 mb-1">B. 股東視角 2028 營收</div>
            <div className="text-2xl font-bold text-brand-blue">{formatNum(partBRevenue)}</div>
            <div className="text-xs text-gray-400 mt-1">億 (Shareholder View)</div>
          </div>

          {/* 最終決策 */}
          <div className="border-2 border-brand-green/50 rounded-lg p-4 bg-emerald-50/30 backdrop-blur-sm text-center">
            <div className="text-xs font-semibold text-brand-green mb-1">最終拍板目標</div>
            <NumericInput
              value={aspirationRevenue}
              onValueChange={onFinalDecision}
              className="neu-input w-full text-center text-2xl font-bold text-brand-green rounded-md px-3 py-1 focus:outline-none"
              placeholder="0"
            />
            <div className="text-xs text-gray-400 mt-1">億 (Final Decision)</div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useEffect, useMemo, lazy, Suspense } from 'react'
import CompanyBasics from './components/CompanyBasics'
import AnsoffTable from './components/AnsoffTable'
import MarketLayersPanel from './components/MarketLayersPanel'
import { SHARE_THRESHOLD, somConsistency } from './lib/marketLayers'
import TsrPanel from './components/TsrPanel'
import FinalDecisionPanel from './components/FinalDecisionPanel'
import SupplyChainTable from './components/SupplyChainTable'
import SectionWrapper from './components/SectionWrapper'

const ExportButton = lazy(() => import('./components/ExportButton'))
import { AuthWidget } from './components/AuthWidget'
import { CloudSyncBootstrap } from './lib/cloud/CloudSyncBootstrap'
import { useAspirationStore } from './store/useAspirationStore'

function calcCAGR(start, end, years = 3) {
  if (!start || start <= 0 || !end || end <= 0) return 0
  return (Math.pow(end / start, 1 / years) - 1) * 100
}

export default function App() {
  useEffect(() => { document.getElementById('app-skeleton')?.remove() }, [])
  const companyInfo = useAspirationStore((s) => s.companyInfo)
  const partA = useAspirationStore((s) => s.partA)
  const partB = useAspirationStore((s) => s.partB)
  const partC = useAspirationStore((s) => s.partC)
  const tamSamSom = useAspirationStore((s) => s.tamSamSom)
  const updateMarketLayer = useAspirationStore((s) => s.updateMarketLayer)
  const updateCompany = useAspirationStore((s) => s.updateCompany)
  const updatePartA = useAspirationStore((s) => s.updatePartA)
  const updatePartB = useAspirationStore((s) => s.updatePartB)
  const updatePartC = useAspirationStore((s) => s.updatePartC)

  const naturalCAGR = useMemo(
    () => calcCAGR(companyInfo.revenue2025, companyInfo.naturalGrowth.targetRevenue2028),
    [companyInfo.revenue2025, companyInfo.naturalGrowth.targetRevenue2028]
  )

  const aspirationCAGR = useMemo(
    () => calcCAGR(companyInfo.revenue2025, companyInfo.aspirationGrowth.targetRevenue2028),
    [companyInfo.revenue2025, companyInfo.aspirationGrowth.targetRevenue2028]
  )

  const partASubtotal = useMemo(
    () => partA.reduce((sum, row) => sum + row.revenue2028, 0),
    [partA]
  )

  // 講義 p31–32：每條賽道在可見未來要能達 20% 以上市佔率
  const lowShareCount = useMemo(
    () => partA.filter((r) => r.marketShare2028 > 0 && r.marketShare2028 < SHARE_THRESHOLD).length,
    [partA]
  )

  // TAM→SAM→SOM 落地到四格後的一致性：四格合計不應超過 SOM
  const somCheck = useMemo(
    () => somConsistency(partASubtotal, tamSamSom && tamSamSom.som ? tamSamSom.som.size : 0),
    [partASubtotal, tamSamSom]
  )

  const activeCategories = useMemo(
    () => new Set(partA.filter(r => r.revenue2028 > 0).map(r => r.id)),
    [partA]
  )

  return (
    <div className="min-h-screen">
      <CloudSyncBootstrap />
      <AuthWidget />

      {/* 頁首 */}
      <header className="glass-header text-gray-800 py-6 px-4 sm:px-6 lg:px-8 no-print">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-gray-100"
            >
              <span>←</span>
              <span>返回藍圖</span>
            </a>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            建立加速增長情境 (Aspiration Case)
          </p>
        </div>
      </header>

      {/* 主內容 */}
      <main id="pdf-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">

        <SectionWrapper title="基本資訊與總目標設定" number="0">
          <CompanyBasics
            data={companyInfo}
            naturalCAGR={naturalCAGR}
            aspirationCAGR={aspirationCAGR}
            onChange={updateCompany}
          />
        </SectionWrapper>

        <SectionWrapper title="A. 客戶/競爭面向：TAM／SAM／SOM 破框 → 安索夫矩陣落地" number="A">
          <MarketLayersPanel data={tamSamSom} onChange={updateMarketLayer} />

          <div className="mt-8 mb-3">
            <h3 className="text-sm font-semibold text-gray-700">② 落地：安索夫矩陣</h3>
            <p className="text-xs text-gray-500 mt-1">
              請把 TAM 依三個層次落地（p30、p37）：這個 TAM 會在什麼產品／市場呈現？哪些是新的、哪些是既有的？
              哪些透過原有商業模式、哪些要採用新商業模式？愈具體愈好（客戶別、產品別），並記住每條賽道要能達到 {SHARE_THRESHOLD}% 以上市佔率。
            </p>
          </div>
          <AnsoffTable data={partA} onChange={updatePartA} />
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2">
            <div className="text-xs">
              {lowShareCount > 0 && (
                <span className="text-amber-600">⚠ 有 {lowShareCount} 個維度的市佔率低於 {SHARE_THRESHOLD}%，請檢視賽道選擇或重新聚焦。</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">客戶視角營收總計</span>
              <span className="text-lg font-bold text-brand-blue">
                {partASubtotal.toLocaleString('zh-TW', { minimumFractionDigits: 0 })} 億
              </span>
            </div>
          </div>
          {somCheck && (
            <p className={`mt-2 px-2 text-xs ${somCheck.level === 'warn' ? 'text-amber-600' : 'text-emerald-700'}`}>
              {somCheck.level === 'warn' ? '⚠ ' : '✓ '}{somCheck.message}
            </p>
          )}
        </SectionWrapper>

        <SectionWrapper title="B. 股東面向 (TSR 架構)" number="B">
          <TsrPanel data={partB} onChange={updatePartB} />
        </SectionWrapper>

        <FinalDecisionPanel
          partASubtotal={partASubtotal}
          partBRevenue={partB.targets2028.revenue}
          aspirationRevenue={companyInfo.aspirationGrowth.targetRevenue2028}
          onFinalDecision={(val) => updateCompany('aspirationGrowth.targetRevenue2028', val)}
        />

        <SectionWrapper title="供應鏈面向瓶頸評估" number="C">
          <SupplyChainTable
            data={partC}
            categories={partA}
            activeCategories={activeCategories}
            onChange={updatePartC}
          />
        </SectionWrapper>
      </main>

      {/* 匯出按鈕 */}
      <div className="no-print sticky bottom-0 glass-header py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex justify-end">
          <Suspense fallback={<span className="text-sm text-gray-400">載入匯出…</span>}>
            <ExportButton companyName={companyInfo.name} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

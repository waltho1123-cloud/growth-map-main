import { useEffect, useMemo, lazy, Suspense } from 'react'
import CompanyBasics from './components/CompanyBasics'
import AnsoffTable from './components/AnsoffTable'
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

        <SectionWrapper title="A. 客戶/競爭面向 (安索夫矩陣)" number="A">
          <AnsoffTable data={partA} onChange={updatePartA} />
          <div className="mt-4 flex items-center justify-end gap-3 px-2">
            <span className="text-sm font-medium text-gray-500">客戶視角營收總計</span>
            <span className="text-lg font-bold text-brand-blue">
              {partASubtotal.toLocaleString('zh-TW', { minimumFractionDigits: 0 })} 億
            </span>
          </div>
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

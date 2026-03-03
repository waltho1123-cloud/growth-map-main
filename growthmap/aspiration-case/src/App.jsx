import { useState, useMemo } from 'react'
import CompanyBasics from './components/CompanyBasics'
import AnsoffTable from './components/AnsoffTable'
import TsrPanel from './components/TsrPanel'
import FinalDecisionPanel from './components/FinalDecisionPanel'
import SupplyChainTable from './components/SupplyChainTable'
import ExportButton from './components/ExportButton'
import SectionWrapper from './components/SectionWrapper'

const INITIAL_PART_A = [
  { id: 'core', category: '既有市場/產品', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newProd', category: '新產品/服務', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newMarket', category: '新市場/客戶', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
  { id: 'newModel', category: '新商業模式', marketSize2028: 0, marketShare2028: 0, revenue2028: 0, description: '' },
]

const INITIAL_PART_C = [
  { categoryId: 'core', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newProd', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newMarket', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
  { categoryId: 'newModel', bottlenecks: { procurement: false, manufacturing: false, logistics: false, tech: false }, breakthrough: '' },
]

function calcCAGR(start, end, years = 3) {
  if (!start || start <= 0 || !end || end <= 0) return 0
  return (Math.pow(end / start, 1 / years) - 1) * 100
}

export default function App() {
  // === 模組一：基本資訊 ===
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    revenue2025: 0,
    naturalGrowth: { targetRevenue2028: 0, cagr: 0 },
    aspirationGrowth: { targetRevenue2028: 0, cagr: 0 },
  })

  // === 模組二：A. 客戶/競爭面向 ===
  const [partA, setPartA] = useState(INITIAL_PART_A)

  // === 模組三：B. 股東面向 ===
  const [partB, setPartB] = useState({
    targetTsr3Years: 0,
    contributions: { revenueGrowth: 0, ebitGrowth: 0, ebitMultiple: 0 },
    targets2028: { revenue: 0, ebitMargin: 0, ebitMultiple: 0 },
  })

  // === 模組四：供應鏈面向 ===
  const [partC, setPartC] = useState(INITIAL_PART_C)

  // === 衍生計算 ===
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

  // === 更新處理函式 ===
  const handleCompanyChange = (field, value) => {
    setCompanyInfo(prev => {
      const next = { ...prev }
      const keys = field.split('.')
      if (keys.length === 1) {
        next[field] = value
      } else {
        next[keys[0]] = { ...prev[keys[0]], [keys[1]]: value }
      }
      return next
    })
  }

  const handlePartAChange = (index, field, value) => {
    setPartA(prev => {
      const next = [...prev]
      const row = { ...next[index], [field]: value }
      if (field === 'marketSize2028' || field === 'marketShare2028') {
        row.revenue2028 = row.marketSize2028 * (row.marketShare2028 / 100)
      }
      next[index] = row
      return next
    })
  }

  const handlePartBChange = (section, field, value) => {
    setPartB(prev => {
      if (!section) return { ...prev, [field]: value }
      return { ...prev, [section]: { ...prev[section], [field]: value } }
    })
  }

  const handlePartCChange = (index, field, value) => {
    setPartC(prev => {
      const next = [...prev]
      if (field === 'breakthrough') {
        next[index] = { ...next[index], breakthrough: value }
      } else {
        next[index] = {
          ...next[index],
          bottlenecks: { ...next[index].bottlenecks, [field]: value },
        }
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 頁首 */}
      <header className="bg-brand-blue text-white py-6 px-8 no-print">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-blue-200 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>返回藍圖</span>
            </a>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            企業成長藍圖
          </h1>
          <p className="text-blue-200 mt-1 text-sm">
            建立加速增長情境 (Aspiration Case)
          </p>
        </div>
      </header>

      {/* 主內容 */}
      <main id="pdf-content" className="max-w-5xl mx-auto px-8 py-8 space-y-8">

        <SectionWrapper title="基本資訊與總目標設定" number="0">
          <CompanyBasics
            data={companyInfo}
            naturalCAGR={naturalCAGR}
            aspirationCAGR={aspirationCAGR}
            onChange={handleCompanyChange}
          />
        </SectionWrapper>

        <SectionWrapper title="A. 客戶/競爭面向 (安索夫矩陣)" number="A">
          <AnsoffTable data={partA} onChange={handlePartAChange} />
          <div className="mt-4 flex items-center justify-end gap-3 px-2">
            <span className="text-sm font-medium text-gray-500">客戶視角營收總計</span>
            <span className="text-lg font-bold text-brand-blue">
              {partASubtotal.toLocaleString('zh-TW', { minimumFractionDigits: 0 })} 億
            </span>
          </div>
        </SectionWrapper>

        <SectionWrapper title="B. 股東面向 (TSR 架構)" number="B">
          <TsrPanel data={partB} onChange={handlePartBChange} />
        </SectionWrapper>

        <FinalDecisionPanel
          partASubtotal={partASubtotal}
          partBRevenue={partB.targets2028.revenue}
          aspirationRevenue={companyInfo.aspirationGrowth.targetRevenue2028}
          onFinalDecision={(val) => handleCompanyChange('aspirationGrowth.targetRevenue2028', val)}
        />

        <SectionWrapper title="供應鏈面向瓶頸評估" number="C">
          <SupplyChainTable
            data={partC}
            categories={partA}
            activeCategories={activeCategories}
            onChange={handlePartCChange}
          />
        </SectionWrapper>
      </main>

      {/* 匯出按鈕 */}
      <div className="no-print sticky bottom-0 bg-white/90 backdrop-blur border-t border-border py-4 px-8">
        <div className="max-w-5xl mx-auto flex justify-end">
          <ExportButton companyName={companyInfo.name} />
        </div>
      </div>
    </div>
  )
}

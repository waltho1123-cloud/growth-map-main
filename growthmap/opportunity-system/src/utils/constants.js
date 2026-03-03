// BCG 外部分析工具 (1-16)
export const BCG_TOOLS = [
  { id: 1, name: '市場地圖 (Market Map)' },
  { id: 2, name: '價值鏈分析 (Value Chain Analysis)' },
  { id: 3, name: '利潤池分析 (Profit Pool)' },
  { id: 4, name: '競爭基準分析 (Competitive Benchmarking)' },
  { id: 5, name: '消費者旅程 (Consumer Journey)' },
  { id: 6, name: '需求空間分析 (Demand Spaces)' },
  { id: 7, name: '品牌定位 (Brand Positioning)' },
  { id: 8, name: '通路分析 (Channel Analysis)' },
  { id: 9, name: '定價分析 (Pricing Analysis)' },
  { id: 10, name: '創新管道 (Innovation Pipeline)' },
  { id: 11, name: '數位成熟度 (Digital Maturity)' },
  { id: 12, name: '永續發展 (Sustainability)' },
  { id: 13, name: '監管環境 (Regulatory Environment)' },
  { id: 14, name: '總體經濟 (Macroeconomic)' },
  { id: 15, name: '情境規劃 (Scenario Planning)' },
  { id: 16, name: '量化分析 (Quantitative Analysis)' },
];

export const COMPANY_TYPES = ['堡壘', '流動', '衰退'];

export const GROWTH_DIMENSIONS = [
  '擴大現有市場',
  '新市場/客戶',
  '新產品',
  '新商業模式',
  '併購',
];

export const GROWTH_LEVERS = [
  '鞏固核心業務',
  '拓展鄰近機會',
  '探索新興市場',
];

// 成長類型依據成長槓桿分群
export const GROWTH_TYPES_MAP = {
  '鞏固核心業務': [
    '優勢變現',
    '市場滲透強化',
    '產品組合優化',
    '營運效率提升',
    '客戶留存提升',
  ],
  '拓展鄰近機會': [
    '企業優勢拓展全球',
    '鄰近市場延伸',
    '通路擴展',
    '新客群開發',
    '品牌延伸',
  ],
  '探索新興市場': [
    '新興市場進入',
    '顛覆式創新',
    '新商業模式試驗',
    '策略聯盟/合資',
    '數位轉型',
  ],
};

export const COMPETITIVE_ENVIRONMENTS = ['飽和', '集中', '分散'];

export const CAGR_OPTIONS = ['>15%', '10-15%', '5-10%', '<5%', '~2-5%', '<2%'];

export const EBIT_OPTIONS = ['>5%', '~2-5%', '<2%'];

export const PROGRESS_TARGET = 10;
export const PROGRESS_MAX = 20;

// BCG 外部觀察 + 內部洞察工具 (1-24)
export const BCG_TOOLS = [
  // 二、外部觀察 — 產業面
  { id: 1, name: '市場地圖' },
  { id: 2, name: '價值鏈分析' },
  { id: 3, name: '全球大趨勢' },
  { id: 4, name: '情境分析與戰略推演' },
  { id: 5, name: '國際市場篩選' },
  { id: 6, name: '數位成長' },
  // 二、外部觀察 — 競爭者面
  { id: 7, name: '創新分析' },
  { id: 8, name: '競爭者策略' },
  { id: 9, name: '顛覆性變革' },
  { id: 10, name: '併購' },
  { id: 11, name: '產品上市模型' },
  { id: 12, name: '商業模式類型' },
  // 二、外部觀察 — 客戶面
  { id: 13, name: '需求導向型成長' },
  { id: 14, name: '客戶趨勢' },
  { id: 15, name: '質性客戶洞察' },
  { id: 16, name: '量化客戶洞察' },
  // 三、內部洞察 — 成長槓桿診斷
  { id: 17, name: '行銷、銷售與訂價診斷' },
  { id: 18, name: '創新診斷' },
  // 三、內部洞察 — 競爭優勢
  { id: 19, name: '優勢盤點' },
  // 三、內部洞察 — 業務組合分析
  { id: 20, name: '異常分析' },
  { id: 21, name: '與強者共贏' },
  { id: 22, name: '業務組合X光' },
  // 三、內部洞察 — 創意工具
  { id: 23, name: '合作機會' },
  { id: 24, name: '重構思維框架' },
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

export const PROGRESS_TARGET = 7;
export const PROGRESS_MAX = 10;

import { BCG_TOOL_LIBRARY } from './toolLibrary';

// 既有相容：BCG_TOOLS（{id, name}）自資料驅動工具庫衍生（ADR-007 / GD-08）。
// 完整定義（category / observationType / fieldSchema）見 toolLibrary.js。
export const BCG_TOOLS = BCG_TOOL_LIBRARY.map(({ id, name }) => ({ id, name }));

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

// 進度（既有 ProgressBar 用；CHK-4 合格區間見下方 LONGLIST_*）
export const PROGRESS_TARGET = 7;
export const PROGRESS_MAX = 10;

// ───────────────────────────────────────────────────────────────
// 以下為 SDD 整合新增常數（資料驅動，GD-08）
// ───────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 2;

export const DEFAULT_CURRENCY = 'TWD';

// CHK-1 緩衝係數（ADR-010，可於設定頁調整）
export const DEFAULT_BUFFER_RATIO = 1.2;

// CHK-4 長清單合格數量區間（SDD §4.3）
export const LONGLIST_MIN = 7;
export const LONGLIST_MAX = 12;

// 機會狀態機（SDD §4.1）
export const OPPORTUNITY_STATUS = {
  DRAFT: 'draft',
  INSIGHT_LINKED: 'insight_linked',
  EVALUATED: 'evaluated',
  SHORTLISTED: 'shortlisted',
  HANDED_OFF: 'handed_off',
  ARCHIVED: 'archived',
};

export const OPPORTUNITY_STATUS_LABELS = {
  draft: '草稿',
  insight_linked: '已連結洞察',
  evaluated: '已評估',
  shortlisted: '納入長清單',
  handed_off: '已交付',
  archived: '已封存',
};

// 工具分析狀態機（SDD §4.2）
export const TOOL_ANALYSIS_STATUS = {
  EMPTY: 'empty',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

// 評分上限（四象限 1–5 燈號）
export const RATING_MAX = 5;

// 機會排序權重（SDD §4.4，可於設定頁調整）
export const SCORING_WEIGHTS = {
  size: 0.30,
  potential: 0.20,
  path: 0.20,
  right: 0.20,
  alignment: 0.10,
};

// 進入策略七面向（模版二，SDD Template2.goToMarket）
export const GO_TO_MARKET_FACETS = [
  { key: 'rnd', label: '研發' },
  { key: 'production', label: '生產' },
  { key: 'pricing', label: '訂價' },
  { key: 'marketing', label: '行銷' },
  { key: 'channel', label: '通路' },
  { key: 'logistics', label: '物流' },
  { key: 'afterSales', label: '售後' },
];

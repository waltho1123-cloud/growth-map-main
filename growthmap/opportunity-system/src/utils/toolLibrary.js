// BCG 工具庫 seed（資料驅動，ADR-007 / GD-08）
// 對照 SDD §4.7：24 工具，本期啟用內部洞察 17–24；外部觀察 1–16 預留。
//
// fieldSchema.fields[] 描述「工具專屬」輸入欄位，由工具分析頁動態渲染。
// 「主要洞察」與「機會」為所有工具共通的強制欄位（FR-02-05），
// 由工具分析頁統一附加，不在各 fieldSchema 內重複定義。
//
// 支援的 field type：
//   text | textarea | number | select | radio | multiselect | rating(1-5)

export const OBSERVATION_TYPE = {
  EXTERNAL: 'external', // 外部觀察
  INTERNAL: 'internal', // 內部洞察
};

// 外部觀察工具（1–16）：預設停用（工作坊主持人視課程啟用）。fieldSchema 為 2026-09-09 依
// 標準策略框架起草的「草案欄位」（fieldSchema.draft=true，分析頁會標示），主持人可直接在此
// 調整；分析頁另保留「觀察資料／研究筆記」自由欄（inputs.notes）餵 AI，見 utils/toolAiInput.js。
const externalTool = (id, name, category, fields = []) => ({
  id,
  name,
  category,
  observationType: OBSERVATION_TYPE.EXTERNAL,
  defaultEnabled: false,
  fieldSchema: { draft: true, fields },
});

export const BCG_TOOL_LIBRARY = [
  // ── 二、外部觀察 — 產業面（1–6）
  externalTool(1, '市場地圖', '產業面', [
      { key: 'segments', label: '市場區隔與規模', type: 'textarea', placeholder: '各區隔的營收／量、成長率（含年份）…' },
      { key: 'players', label: '主要參與者與市佔', type: 'textarea', placeholder: '前 3–5 名品牌、市佔與定位…' },
      { key: 'growthPockets', label: '成長口袋（成長最快／獲利最好的區隔）', type: 'textarea' },
      { key: 'ourPosition', label: '我們在地圖上的位置', type: 'select', options: ['領導者', '挑戰者', '利基者', '尚未進入'] },
      { key: 'dataSources', label: '資料來源與年份', type: 'text', placeholder: '例：工研院 2025 產業年鑑、內部銷售資料' },
  ]),
  externalTool(2, '價值鏈分析', '產業面', [
      { key: 'stages', label: '產業價值鏈環節與利潤池', type: 'textarea', placeholder: '原料→製造→品牌→通路→服務，各環節毛利／利潤占比…' },
      { key: 'ourStages', label: '我們涵蓋的環節與毛利', type: 'textarea' },
      { key: 'bottlenecks', label: '價值集中或被擠壓的環節', type: 'textarea' },
      { key: 'shiftOpportunities', label: '向上下游延伸／去中介化／外包的機會', type: 'textarea' },
  ]),
  externalTool(3, '全球大趨勢', '產業面', [
      { key: 'trends', label: '相關大趨勢（可複選）', type: 'multiselect', options: ['人口結構與高齡化', '永續與能源轉型', '數位化與 AI', '地緣政治與供應鏈重組', '健康意識', '消費價值觀變遷', '城市化', '其他'] },
      { key: 'impact', label: '對本產業的影響路徑（3–5 年）', type: 'textarea' },
      { key: 'timing', label: '影響時程', type: 'select', options: ['已發生', '1–3 年', '3–5 年', '5 年以上'] },
      { key: 'implications', label: '對我們的意涵（威脅／機會）', type: 'textarea' },
  ]),
  externalTool(4, '情境分析與戰略推演', '產業面', [
      { key: 'uncertainties', label: '兩大關鍵不確定性（情境軸）', type: 'textarea', placeholder: '例：原物料價格高／低 × 法規開放／收緊' },
      { key: 'scenarios', label: '四個情境摘要', type: 'textarea' },
      { key: 'robustMoves', label: '各情境皆成立的無悔行動', type: 'textarea' },
      { key: 'triggers', label: '情境轉折的領先指標與監測方式', type: 'textarea' },
  ]),
  externalTool(5, '國際市場篩選', '產業面', [
      { key: 'candidates', label: '候選市場清單', type: 'textarea' },
      { key: 'criteria', label: '篩選準則（可複選）', type: 'multiselect', options: ['市場規模', '成長率', '競爭強度', '法規與關稅', '通路可及性', '文化與語言', '物流成本', '既有客戶關係'] },
      { key: 'shortlist', label: '前 2–3 名市場與理由', type: 'textarea' },
      { key: 'entryMode', label: '進入模式', type: 'select', options: ['出口', '代理／經銷', '合資', '自設據點', '併購'] },
  ]),
  externalTool(6, '數位成長', '產業面', [
      { key: 'digitalShare', label: '數位通路營收占比（%）', type: 'number', placeholder: '0–100' },
      { key: 'maturity', label: '數位成熟度（1 低 – 5 高）', type: 'rating' },
      { key: 'gaps', label: '待補能力（可複選）', type: 'multiselect', options: ['電商營運', '數據與 CRM', '數位行銷', '流程自動化', '平台生態', '訂閱與服務化'] },
      { key: 'initiatives', label: '數位成長機會與優先序', type: 'textarea' },
  ]),
  // ── 二、外部觀察 — 競爭者面（7–12）
  externalTool(7, '創新分析', '競爭者面', [
      { key: 'pipeline', label: '產業近 3 年重要創新（產品／製程／商模）', type: 'textarea' },
      { key: 'innovationType', label: '創新類型（可複選）', type: 'multiselect', options: ['漸進式', '突破式', '架構式', '商業模式'] },
      { key: 'ourRD', label: '我們的創新投入與產出', type: 'textarea' },
      { key: 'whiteSpace', label: '尚未被滿足的創新空白', type: 'textarea' },
  ]),
  externalTool(8, '競爭者策略', '競爭者面', [
      { key: 'competitors', label: '主要競爭者（3–5 家）與定位', type: 'textarea' },
      { key: 'moves', label: '近期策略動作（擴產／併購／降價／新市場）', type: 'textarea' },
      { key: 'strengthsWeaknesses', label: '對手強弱項', type: 'textarea' },
      { key: 'response', label: '我們可利用的空隙與需防守的點', type: 'textarea' },
  ]),
  externalTool(9, '顛覆性變革', '競爭者面', [
      { key: 'disruptors', label: '新進者／替代品／新技術', type: 'textarea' },
      { key: 'jobsToBeDone', label: '被顛覆的客戶任務與低端／新市場切入點', type: 'textarea' },
      { key: 'timeline', label: '顛覆時程', type: 'select', options: ['已發生', '1–2 年', '3–5 年', '不確定'] },
      { key: 'response', label: '因應選項（自我顛覆／併購／聯盟／退出）', type: 'textarea' },
  ]),
  externalTool(10, '併購', '競爭者面', [
      { key: 'targets', label: '潛在標的與其能力／市場', type: 'textarea' },
      { key: 'rationale', label: '併購邏輯（可複選）', type: 'multiselect', options: ['規模經濟', '能力取得', '進入新市場', '垂直整合', '消除競爭', '取得人才'] },
      { key: 'synergies', label: '綜效估算與整合風險', type: 'textarea' },
      { key: 'feasibility', label: '可行性（資金／整合能力，1–5）', type: 'rating' },
  ]),
  externalTool(11, '產品上市模型', '競爭者面', [
      { key: 'segment', label: '目標客群與價值主張', type: 'textarea' },
      { key: 'channelModel', label: '上市模式（可複選）', type: 'multiselect', options: ['直銷', '經銷', '電商', '平台', '訂閱', 'B2B2C'] },
      { key: 'pricing', label: '定價與獲客成本假設', type: 'textarea' },
      { key: 'launchPlan', label: '上市節奏與里程碑', type: 'textarea' },
  ]),
  externalTool(12, '商業模式類型', '競爭者面', [
      { key: 'currentModel', label: '目前商業模式', type: 'select', options: ['製造銷售', '品牌零售', '平台', '訂閱', '服務化', '授權', '其他'] },
      { key: 'alternatives', label: '可轉型的模式（可複選）', type: 'multiselect', options: ['製造銷售', '品牌零售', '平台', '訂閱', '服務化', '授權'] },
      { key: 'economics', label: '新模式的營收／成本結構變化', type: 'textarea' },
      { key: 'risks', label: '轉型障礙與風險', type: 'textarea' },
  ]),
  // ── 二、外部觀察 — 客戶面（13–16）
  externalTool(13, '需求導向型成長', '客戶面', [
      { key: 'demandSpaces', label: '需求空間地圖（場合 × 需求）', type: 'textarea' },
      { key: 'underserved', label: '需求大但供給弱的空間', type: 'textarea' },
      { key: 'ourFit', label: '我們與該需求空間的契合度（1–5）', type: 'rating' },
      { key: 'offerIdeas', label: '對應的產品／服務構想', type: 'textarea' },
  ]),
  externalTool(14, '客戶趨勢', '客戶面', [
      { key: 'trends', label: '客戶行為與偏好變化（3 年內）', type: 'textarea' },
      { key: 'drivers', label: '驅動因素（可複選）', type: 'multiselect', options: ['世代更替', '所得變化', '數位習慣', '永續意識', '健康意識', '便利性', '個人化'] },
      { key: 'evidence', label: '證據（數據／觀察）', type: 'textarea' },
      { key: 'implications', label: '對產品／通路／溝通的意涵', type: 'textarea' },
  ]),
  externalTool(15, '質性客戶洞察', '客戶面', [
      { key: 'method', label: '方法（可複選）', type: 'multiselect', options: ['深度訪談', '焦點團體', '田野觀察', '客服紀錄', '社群聆聽'] },
      { key: 'sampleSize', label: '樣本數', type: 'number' },
      { key: 'painPoints', label: '痛點與未滿足需求（附引述）', type: 'textarea' },
      { key: 'surprises', label: '出乎意料的發現', type: 'textarea' },
  ]),
  externalTool(16, '量化客戶洞察', '客戶面', [
      { key: 'source', label: '資料來源（問卷／交易資料／NPS／流量）', type: 'textarea' },
      { key: 'sampleSize', label: '樣本數', type: 'number' },
      { key: 'keyMetrics', label: '關鍵數字（滿意度、留存、購買頻率、客單）', type: 'textarea' },
      { key: 'segmentsFound', label: '統計上有意義的客群差異', type: 'textarea' },
  ]),

  // ── 三、內部洞察 — 成長槓桿診斷（17–18）
  {
    id: 17,
    name: '行銷、銷售與訂價診斷',
    category: '成長槓桿診斷',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        {
          key: 'dimensions',
          label: '15 項診斷（勾選有改善空間者）',
          type: 'multiselect',
          options: [
            '品牌定位', '市場區隔', '產品組合', '推廣策略', '數位行銷',
            '通路覆蓋', '業務生產力', '客戶關係', '交叉銷售', '銷售流程',
            '定價策略', '折扣管理', '價格彈性', '價值定價', '合約條款',
          ],
        },
        { key: 'currentState', label: '現況描述與痛點', type: 'textarea', placeholder: '各項診斷的現況、落差與量化證據…' },
      ],
    },
  },
  {
    id: 18,
    name: '創新診斷',
    category: '成長槓桿診斷',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        {
          key: 'innovationModes',
          label: '創新模式定位（可複選）',
          type: 'multiselect',
          options: ['產品創新', '服務創新', '商業模式創新', '流程創新', '體驗創新', '生態系創新'],
        },
        { key: 'gap', label: '創新落差', type: 'textarea', placeholder: '與標竿/期望的差距…' },
        { key: 'benchmark', label: '創新典範參照', type: 'textarea', placeholder: '可借鏡的標竿做法…' },
      ],
    },
  },

  // ── 三、內部洞察 — 競爭優勢（19）
  {
    id: 19,
    name: '優勢盤點',
    category: '競爭優勢',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        { key: 'userValueImportance', label: '用戶價值 — 重要程度', type: 'rating' },
        { key: 'userValueStrength', label: '用戶價值 — 相對優勢', type: 'rating' },
        { key: 'costImportance', label: '成本 — 重要程度', type: 'rating' },
        { key: 'costStrength', label: '成本 — 相對優勢', type: 'rating' },
        { key: 'adaptabilityImportance', label: '市場適應力 — 重要程度', type: 'rating' },
        { key: 'adaptabilityStrength', label: '市場適應力 — 相對優勢', type: 'rating' },
        { key: 'summary', label: '2×2 定位摘要', type: 'textarea', placeholder: '高重要×高優勢者為可變現強項…' },
      ],
    },
  },

  // ── 三、內部洞察 — 業務組合分析（20–22）
  {
    id: 20,
    name: '異常分析',
    category: '業務組合分析',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        {
          key: 'dimensions',
          label: '分析維度（可複選）',
          type: 'multiselect',
          options: ['地域', '通路', '產品', '客戶', '業務員'],
        },
        { key: 'anomalies', label: '異常發現', type: 'textarea', placeholder: '高/低於預期的區隔、成長或衰退的異常點…' },
        { key: 'rootCause', label: '可能成因', type: 'textarea' },
      ],
    },
  },
  {
    id: 21,
    name: '與強者共贏',
    category: '業務組合分析',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        { key: 'benchmark', label: '標竿/強者對象', type: 'text', placeholder: '通路或品類的領先者…' },
        { key: 'shareVsScale', label: '通路市佔成長 vs 規模成長', type: 'textarea', placeholder: '對比分析…' },
        { key: 'yoy', label: '跨年變化', type: 'textarea', placeholder: '近 2–3 年趨勢…' },
      ],
    },
  },
  {
    id: 22,
    name: '業務組合X光',
    category: '業務組合分析',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        { key: 'strategicFit', label: '策略視角評分', type: 'rating' },
        { key: 'valueCreation', label: '價值創造視角評分', type: 'rating' },
        { key: 'ownership', label: '所有權視角評分', type: 'rating' },
        { key: 'notes', label: '組合取捨說明', type: 'textarea', placeholder: '留/汰/投資/分拆的判斷…' },
      ],
    },
  },

  // ── 三、內部洞察 — 創意工具（23–24）
  {
    id: 23,
    name: '合作機會',
    category: '創意工具',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        { key: 'q1', label: '跨 BU 提問 1：誰擁有我們需要的能力/資產？', type: 'textarea' },
        { key: 'q2', label: '跨 BU 提問 2：哪裡能共享通路/客戶？', type: 'textarea' },
        { key: 'q3', label: '跨 BU 提問 3：哪些價值鏈環節可共投資？', type: 'textarea' },
        { key: 'coInvest', label: '價值鏈共投資點', type: 'textarea' },
      ],
    },
  },
  {
    id: 24,
    name: '重構思維框架',
    category: '創意工具',
    observationType: OBSERVATION_TYPE.INTERNAL,
    defaultEnabled: true,
    fieldSchema: {
      fields: [
        { key: 'tinb', label: 'TINB 五步（This Is Not But…）', type: 'textarea', placeholder: '逐步重構既有假設…' },
        { key: 'asOtherCompany', label: '換作別家公司會怎麼做？', type: 'textarea' },
        { key: 'asCustomer', label: '換作客戶會怎麼看？', type: 'textarea' },
      ],
    },
  },
];

// 原型 ↔ 建議成長模式 ↔ 建議分析工具（SDD §4.7，資料驅動；供 CHK-3 與工具建議）
export const ARCHETYPE_GUIDANCE = {
  堡壘: {
    recommendedModes: ['鞏固核心業務', '拓展鄰近機會'],
    recommendedTools: [17, 20, 21, 19],
    note: '強化核心、適度延伸',
  },
  流動: {
    recommendedModes: ['鞏固核心業務', '拓展鄰近機會', '探索新興市場'],
    recommendedTools: [18, 22, 24],
    note: '多點布局、提高勝率',
  },
  衰退: {
    recommendedModes: ['拓展鄰近機會', '探索新興市場'],
    recommendedTools: [24, 18, 23],
    note: '審時度勢、重塑定位',
  },
};

// 工具 id → 名稱 快查
export const TOOL_NAME_BY_ID = BCG_TOOL_LIBRARY.reduce((acc, t) => {
  acc[t.id] = t.name;
  return acc;
}, {});

// 預設啟用集合（17–24）
export const DEFAULT_ENABLED_TOOL_CODES = BCG_TOOL_LIBRARY
  .filter((t) => t.defaultEnabled)
  .map((t) => t.id);

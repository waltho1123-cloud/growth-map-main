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

// 外部觀察工具（1–16）預留：本期停用，fieldSchema 暫空，之後擴充免改程式。
const externalTool = (id, name, category) => ({
  id,
  name,
  category,
  observationType: OBSERVATION_TYPE.EXTERNAL,
  defaultEnabled: false,
  fieldSchema: { fields: [] },
});

export const BCG_TOOL_LIBRARY = [
  // ── 二、外部觀察 — 產業面（1–6）
  externalTool(1, '市場地圖', '產業面'),
  externalTool(2, '價值鏈分析', '產業面'),
  externalTool(3, '全球大趨勢', '產業面'),
  externalTool(4, '情境分析與戰略推演', '產業面'),
  externalTool(5, '國際市場篩選', '產業面'),
  externalTool(6, '數位成長', '產業面'),
  // ── 二、外部觀察 — 競爭者面（7–12）
  externalTool(7, '創新分析', '競爭者面'),
  externalTool(8, '競爭者策略', '競爭者面'),
  externalTool(9, '顛覆性變革', '競爭者面'),
  externalTool(10, '併購', '競爭者面'),
  externalTool(11, '產品上市模型', '競爭者面'),
  externalTool(12, '商業模式類型', '競爭者面'),
  // ── 二、外部觀察 — 客戶面（13–16）
  externalTool(13, '需求導向型成長', '客戶面'),
  externalTool(14, '客戶趨勢', '客戶面'),
  externalTool(15, '質性客戶洞察', '客戶面'),
  externalTool(16, '量化客戶洞察', '客戶面'),

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

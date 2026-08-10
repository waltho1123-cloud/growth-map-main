// 四維評估標準（PRD P-03）——BCG 預設定義為系統常數（不可刪除、可加註）。
// 維度 key 與單元三 template3.ratings 的 key 一致（size/potential/path/rightToWin），
// 讓第三堂的初評可以無縫帶入第四堂當參考。

export const DIMENSIONS = Object.freeze([
  Object.freeze({
    key: 'size',
    no: 1,
    name: '市場規模 & 競爭',
    en: 'Size of the prize',
    oneLiner: '機會本身的吸引力',
    points: '可用市場或分群之價值規模、預估可捕捉之份額、成長率、獲利能力（不考慮執行風險）',
    axis: 'y',
  }),
  Object.freeze({
    key: 'potential',
    no: 2,
    name: '操作潛力',
    en: 'Potential of play',
    oneLiner: '與現有資源的綜效',
    points: '是否可衍生額外機會點、具備形成聯合策略方案的潛力、與整體策略方向一致、與大趨勢一致',
    axis: 'y',
  }),
  Object.freeze({
    key: 'path',
    no: 3,
    name: '達成路徑',
    en: 'Path to achieve',
    oneLiner: '機會可行性',
    points: '所需資金／資本密集度、建構時間、執行風險、能力風險、報復性風險',
    axis: 'x',
  }),
  Object.freeze({
    key: 'rightToWin',
    no: 4,
    name: '取勝之道',
    en: 'Right to win',
    oneLiner: '公司本身的優勢',
    points: '競爭優勢（價值主張、成本、動態優勢）、產業動態與優勢穩定度、目標市場的潛在起始定位',
    axis: 'x',
  }),
]);

export const DIMENSION_KEYS = Object.freeze(DIMENSIONS.map((d) => d.key));

// BCG 預設量表錨點（1–5，可覆寫）
export const DEFAULT_ANCHORS = Object.freeze({
  5: '明顯優異，可直接支撐決策',
  4: '良好，有具體依據',
  3: '中等／證據不足但無明顯疑慮',
  2: '偏弱，存在已知障礙',
  1: '明顯不利，短期難以克服',
});

// criteria 文件預設形狀（存在專案文件的 criteria 欄位）
export function createDefaultCriteria() {
  const anchors = {};
  for (const d of DIMENSIONS) anchors[d.key] = { ...DEFAULT_ANCHORS };
  return {
    annotations: { size: '', potential: '', path: '', rightToWin: '' }, // 本公司語言加註
    anchors,
    weighting: { enabled: false, reason: '', weights: { size: 25, potential: 25, path: 25, rightToWin: 25 } },
    autoFullPotentialHint: true, // PD-05：已是策略方案者僅「提示」操作潛力可視滿分，不自動填分
    approved: false,
    approvedBy: null,
    approvedAt: null,
  };
}

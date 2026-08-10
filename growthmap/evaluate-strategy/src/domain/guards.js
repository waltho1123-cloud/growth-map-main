// 防呆規則引擎（PRD §6.1 GR-1～GR-7 之純函式部分）。
// 啟發式檢查只「標黃提示」，不阻擋輸入（鐵則 2：系統不代替人做決定）；
// 阻擋型規則（GR-4 >5）由呼叫端依回傳狀態停用按鈕。

// ── GR-1：機會點必須是「市場／賽道＋商模或策略」，不得是方法或目標 ────────────
// 啟發式（對抗式審查後加嚴）：方法動詞開頭或目標型名詞出現時，必須「同時」具備
// 市場語彙＋策略機制語彙才放行——「提升通路效率」含市場名詞但無策略機制，仍標黃。
const METHOD_VERB = /^(提升|強化|增加|改善|優化|提高|降低|加強|深化|擴大)/;
const GOAL_NOUN = /(知名度|指名度|滿意度|忠誠度|曝光度|市佔率|能力|效率|產能|良率|形象)/;
const MARKET_HINT = /(市場|賽道|通路|客群|客戶群|場域|事業|產業|領域|服務|產品線|商模|商業模式|平台|解決方案|據點|海外|市占)/;
const STRATEGY_HINT = /(透過|藉由|入股|併購|合資|自建|建立|推出|開發|切入|進軍|跨足|拓展|經營|打造|成立|佈局|代理|授權|訂閱)/;

export function checkGr1(text) {
  const t = String(text || '').trim();
  if (!t) return { flagged: false, reason: '' };
  const looksMethodOrGoal = METHOD_VERB.test(t) || GOAL_NOUN.test(t);
  const hasMarketAndStrategy = MARKET_HINT.test(t) && STRATEGY_HINT.test(t);
  if (looksMethodOrGoal && !hasMarketAndStrategy) {
    return {
      flagged: true,
      reason: '這看起來像「方法」或「目標」，不是增長機會。試著先寫市場或賽道，再補商模與策略。' +
        '例如把「提升品牌指名度」改成「跨足通路端：透過入股通路商建立自有通路，以提升品牌指名度」。',
    };
  }
  return { flagged: false, reason: '' };
}

// ── GR-3：矩陣泡泡必須顯示機會點名稱，不得只是編號或工具名 ────────────────────
const NUMBERING_ONLY = /^[#＃\d\s.\-–—]+$/;
const TOOL_NAME_LIKE = /^(工具|BCG|#?\d{1,2}[\s.．]|＃?\d{1,2}[\s.．])/;

export function checkGr3(name) {
  const t = String(name || '').trim();
  if (!t) return { flagged: true, reason: '機會點名稱為空——矩陣上要看得到機會本身，不能只放編號或工具名。' };
  if (NUMBERING_ONLY.test(t) || TOOL_NAME_LIKE.test(t)) {
    return { flagged: true, reason: '這個名稱看起來只是編號或工具名。矩陣上要看得到機會本身。' };
  }
  return { flagged: false, reason: '' };
}

// ── GR-4：策略方案數 1–3（黃燈 4–5、>5 硬阻擋）────────────────────────────────
export function playCountStatus(n, { warnAt = 3, max = 5 } = {}) {
  if (n > max) {
    return { level: 'block', message: `策略方案超過 ${max} 個等於沒有收斂，請先合併或擱置。` };
  }
  if (n > warnAt) {
    return { level: 'warn', message: `方法論建議收斂到 1–${warnAt} 個。超過三個請說明為什麼還要保留。` };
  }
  if (n === 0) return { level: 'empty', message: '尚未建立策略方案。' };
  return { level: 'ok', message: '' };
}

// ── GR-7：評估內容不得過於簡略／通用 ─────────────────────────────────────────
// 泛用詞字典：換成別家公司也成立的詞。判定（對抗式審查後加嚴）：
// (a) 全句即泛用詞；(b) 短句含泛用詞且無具體性標記；(c) 命中 ≥2 個泛用詞
//     且無具體性標記（「導入AI應用提升客戶體驗與數位轉型」這類串珠句）。
const GENERIC_TERMS = [
  'AI 應用', 'AI應用', '導入AI', '導入 AI', '大數據分析', '大數據', '數位轉型', '智慧化',
  '品牌曝光度', '品牌曝光', '品牌行銷', '數位行銷', '異業合作', '策略合作', '合作',
  '創新', '差異化', '提升品質', '人才培育', '顧客體驗', '客戶體驗', '客戶關係',
  '整合資源', '資源整合', '綜效', '平台化', '生態系',
];
// 具體性標記：數字、規格/認證——有這些通常代表寫的是可驗證的具體項目。
// 量詞（位/家/萬…）必須跟在數字後才算數，否則「數位轉型」的「位」會誤判為具體。
const CONCRETE_HINT = /[0-9０-９]|ISO|GMP|HACCP|FDA|UL|專利|認證|驗證|證照/;

export function checkGr7(text) {
  const t = String(text || '').trim().replace(/[。.!！\s]+$/, '');
  if (!t) return { flagged: false, reason: '' };
  const hits = GENERIC_TERMS.filter((g) => t.includes(g));
  const concrete = CONCRETE_HINT.test(t);
  const generic =
    GENERIC_TERMS.some((g) => t === g)
    || (t.length <= 6 && GENERIC_TERMS.some((g) => t.includes(g) || g.includes(t)))
    || (!concrete && t.length <= 12 && hits.length >= 1)
    || (!concrete && hits.length >= 2);
  if (generic) {
    return {
      flagged: true,
      reason: '這個描述太通用了，換成別家公司也成立。請寫出針對這個機會的具體項目，' +
        '例如「取得 ISO 14644 驗證」「增聘並培育技術開發人員」。',
    };
  }
  return { flagged: false, reason: '' };
}

// ── 機會點品質旗標彙整（P-02 表格用）──────────────────────────────────────────
export function computeOpportunityFlags(opp) {
  const gr1 = checkGr1(opp?.opportunityName);
  const tamMissing = !(Number(opp?.tam) > 0) && !(Number(opp?.sam) > 0);
  const t = opp?.template1 || {};
  const t2 = opp?.template2 || {};
  const t3 = opp?.template3 || {};
  const templateIncomplete =
    !(t.insights || t.growthLever) || !(t2.concept || t2.method) || !(t3.marketSize || t3.currentScale);
  return {
    gr1: gr1.flagged,
    gr1Reason: gr1.reason,
    tamMissing,
    templateIncomplete,
  };
}

// 長清單數量檢核（FR-02-04）：7–10 為建議區間，可放寬至 15 並警示
export function longlistCountStatus(n) {
  if (n < 7) return { level: 'warn', message: `目前 ${n} 個機會，建議至少 7 個以確保覆蓋度。` };
  if (n > 15) return { level: 'warn', message: `目前 ${n} 個機會，數量過多，建議先做初步篩除。` };
  if (n > 10) return { level: 'info', message: `目前 ${n} 個機會（超出 7–10 建議區間，可先初篩）。` };
  return { level: 'ok', message: '' };
}

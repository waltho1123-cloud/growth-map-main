// 評分引擎（PRD MOD-03）：總分、雙軸座標、多評分者彙總與離散度。
// 純函式——不觸 Firestore、不觸 React。

import { DIMENSION_KEYS } from './criteria';

const clampScore = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 0; // 0 = 未評
  return Math.min(5, Math.round(n));
};

// 四維總分（滿分 20）；未評的維度以 0 計
export function totalOf(dims) {
  if (!dims || typeof dims !== 'object') return 0;
  return DIMENSION_KEYS.reduce((sum, k) => sum + clampScore(dims[k]), 0);
}

// 是否四維皆已評（1–5）
export function isComplete(dims) {
  return DIMENSION_KEYS.every((k) => clampScore(dims?.[k]) >= 1);
}

const round1 = (v) => Math.round(v * 10) / 10;

// 軸線用的值域夾取：不取整——彙總後的平均分（如 3.5）必須保留小數
const clampAxisValue = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(5, n);
};

// 雙軸座標：縱軸 機會吸引力＝(①+②)/2、橫軸 執行難易度＝(③+④)/2，一位小數。
// 加權啟用時（PD-01 預設關閉）以權重加權平均取代等權平均。
export function axesOf(dims, weighting = null) {
  const s = (k) => clampAxisValue(dims?.[k]);
  if (weighting?.enabled) {
    const w = weighting.weights || {};
    const wy = (Number(w.size) || 0) + (Number(w.potential) || 0);
    const wx = (Number(w.path) || 0) + (Number(w.rightToWin) || 0);
    return {
      y: round1(wy > 0 ? (s('size') * (Number(w.size) || 0) + s('potential') * (Number(w.potential) || 0)) / wy : 0),
      x: round1(wx > 0 ? (s('path') * (Number(w.path) || 0) + s('rightToWin') * (Number(w.rightToWin) || 0)) / wx : 0),
    };
  }
  return {
    y: round1((s('size') + s('potential')) / 2),
    x: round1((s('path') + s('rightToWin')) / 2),
  };
}

// 極端分數（1 或 5）評分依據必填（P-04 驗證）
export function rationaleRequired(value) {
  const v = clampScore(value);
  return v === 1 || v === 5;
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 彙總單一機會在某輪次的多評分者分數。
// scores：該機會該輪次的 score 文件陣列（只計 submitted）。
// dispersionThreshold：極差 ≥ 此值標記「需複議」（預設 2，設定頁可調）。
export function aggregateScores(scores, { dispersionThreshold = 2, weighting = null } = {}) {
  const submitted = (scores || []).filter((s) => s && s.submitted && s.dims);
  const perDim = {};
  let anyFlagged = false;
  for (const k of DIMENSION_KEYS) {
    const values = submitted.map((s) => clampScore(s.dims[k])).filter((v) => v >= 1);
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const range = values.length ? sorted[sorted.length - 1] - sorted[0] : 0;
    const flagged = values.length >= 2 && range >= dispersionThreshold;
    if (flagged) anyFlagged = true;
    perDim[k] = {
      mean: round1(mean),
      median: median(sorted),
      range,
      count: values.length,
      flagged,
    };
  }
  const avgDims = {
    size: perDim.size.mean,
    potential: perDim.potential.mean,
    path: perDim.path.mean,
    rightToWin: perDim.rightToWin.mean,
  };
  const total = round1(DIMENSION_KEYS.reduce((sum, k) => sum + perDim[k].mean, 0));
  return {
    perDim,
    total, // 平均後總分（滿分 20）
    axes: axesOf(avgDims, weighting),
    scorerCount: submitted.length,
    complete: submitted.length > 0 && DIMENSION_KEYS.every((k) => perDim[k].count === submitted.length),
    needsReview: anyFlagged, // 任一維極差過大 → 需複議（US-005）
  };
}

// score 文件 ID 慣例：一位評分者 × 一個機會 × 一輪 = 一份文件（並行編輯零衝突）
export function scoreDocId(oppId, round, uid) {
  return `${oppId}__r${round}__${uid}`;
}

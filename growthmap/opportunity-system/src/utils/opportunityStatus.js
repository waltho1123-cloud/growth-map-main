import { OPPORTUNITY_STATUS } from './constants';

// 機會狀態機（SDD §4.1）的守衛與推導。
// 設計：draft / insight_linked / evaluated 由「內容完整度」自動推導；
// shortlisted / handed_off / archived 為持久人為旗標（存於 opp.status）。

// 模版三四象限是否皆已評分（complete_eval 守衛之一）
export function isEvalComplete(opp) {
  const r = (opp.template3 && opp.template3.ratings) || {};
  return r.size > 0 && r.potential > 0 && r.path > 0 && r.rightToWin > 0;
}

// 已連結 ≥1 來源工具且模版一有洞察（link_insight 守衛）
export function hasInsight(opp) {
  const tools = opp.usedTools || [];
  const ins = (opp.template1 && opp.template1.insights) || '';
  return tools.length > 0 && ins.trim().length > 0;
}

export function hasRevenue(opp) {
  return Number(opp.estRevenue) > 0;
}

// 自動推導的基本狀態
export function deriveBaseStatus(opp) {
  if (isEvalComplete(opp) && hasRevenue(opp)) return OPPORTUNITY_STATUS.EVALUATED;
  if (hasInsight(opp)) return OPPORTUNITY_STATUS.INSIGHT_LINKED;
  return OPPORTUNITY_STATUS.DRAFT;
}

// 能否納入長清單（evaluated → shortlisted）：須完成模版三評分與預估營收
export function canShortlist(opp) {
  return isEvalComplete(opp) && hasRevenue(opp);
}

// 實際顯示狀態：人為旗標優先，否則自動推導
export function effectiveStatus(opp) {
  // shortlisted 是人為旗標，但若機會已不再符合納入資格（評分被清空 / 營收歸零），
  // 旗標即失效並回退自動推導，避免不合格機會仍留在長清單、CHK 與交付快照中。
  if (opp.status === OPPORTUNITY_STATUS.SHORTLISTED) {
    return canShortlist(opp) ? OPPORTUNITY_STATUS.SHORTLISTED : deriveBaseStatus(opp);
  }
  if (opp.status === OPPORTUNITY_STATUS.HANDED_OFF || opp.status === OPPORTUNITY_STATUS.ARCHIVED) {
    return opp.status;
  }
  return deriveBaseStatus(opp);
}

// 長清單成員（供 CHK-1/4、進度、排序）
export function isShortlisted(opp) {
  return effectiveStatus(opp) === OPPORTUNITY_STATUS.SHORTLISTED;
}

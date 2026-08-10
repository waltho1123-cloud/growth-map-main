// 資料模型工廠（evalProjects 文件形狀的唯一正本）。
// 多人架構：evalProjects/{pid} 專案文件 ＋ opportunities/rounds/scores/plays/assumptions/handoffs 子集合。
// 與單元一～三的單人 users/{uid}/apps/* 模型刻意分離（見 firestore.rules）。

import { createDefaultCriteria } from './criteria';
import { createEmptyFin } from './finance';
import { computeOpportunityFlags } from './guards';

export const SCHEMA_VERSION = 1;

// 角色（PRD §3.1 簡化為四種；細部權限矩陣屬 UI 層，coach 唯讀由規則層強制）
export const ROLES = Object.freeze({
  owner: Object.freeze({ key: 'owner', label: '負責人（R-LEAD）', editable: true }),
  facilitator: Object.freeze({ key: 'facilitator', label: '主持人（R-FACIL）', editable: true }),
  member: Object.freeze({ key: 'member', label: '成員（評分／方案／財務）', editable: true }),
  coach: Object.freeze({ key: 'coach', label: '教練／顧問（唯讀＋評論）', editable: false }),
});

export function canEdit(role) {
  return !!ROLES[role]?.editable;
}

export const SANITY_QUESTIONS = Object.freeze([
  '客戶對公司的看法會有什麼改變？',
  '員工對公司的看法會有什麼改變？',
  '投資者如何評價及其影響？',
  '競爭對手可能如何回應？',
  '與供應商關係會受到哪些影響？',
  '是否與企業整體策略與目標一致？',
  '是否與公司願景與使命相符？',
]);

export function createProjectDoc({ name, uid, email, displayName }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: name || '未命名評估專案',
    createdAt: Date.now(),
    createdBy: uid,
    stage: 'intake',
    memberUids: [uid],
    members: { [uid]: { role: 'owner', email: email || '', displayName: displayName || '' } },
    invitedEmails: [],
    inviteRoles: {},
    criteria: createDefaultCriteria(),
    settings: {
      taxRate: 0.2,          // OQ-A：預設 20%，設定頁可調
      currency: 'TWD',
      unit: 'M',             // 表頭單位標示（TWD M）
      forecastYears: 3,      // PD-04：3–5 年
      playWarn: 3,           // PD-03
      playMax: 5,            // PD-03（上限不得 >5）
      availableCapital: null, // OQ-A：可用資金上限（現金流硬檢查用）
      availableFte: null,
      assumptionTargetRatio: 0.8, // CHK-5
      dispersionThreshold: 2,     // 複議門檻（極差 ≥ 2）
    },
    // 承接來源（單元三交付快照的中繼資料；機會內容在 opportunities 子集合）
    source: null, // { version, frozenAt, archetype, importedAt, importedBy, contractOk }
    // 第二堂差距核心值（快照自 handoff.targetSnapshot；unit 4 不得改寫上游）
    targetSnapshot: null, // { aspiration, momentum, growthGap, currency }
    // 綜效（PD-06：強制分列收入綜效/成本綜效；長度隨 forecastYears）
    synergies: { revenue: [0, 0, 0], cost: [0, 0, 0], beneficiary: '', note: '' },
    // 疊加未達標時選定的回頭路徑（P-10 DoD）
    fallbackDecision: null, // { path, note, decidedBy, decidedAt }
    // 定位衝擊與共識（P-12）
    consensus: {
      sanity: SANITY_QUESTIONS.map(() => ({ impact: '', note: '' })), // impact: positive/neutral/negative/severe
      why: [], what: [], how: [],
      ceoNarrative: { checked: false, note: '' },
    },
    lastCheckRun: null,
    lastHandoff: null, // { version, frozenAt }
  };
}

// ── 機會點（opportunities 子集合）────────────────────────────────────────────

// 「上游欄位」＝承接自第三堂、可能被上游修正版更新的欄位集合。
// 重同步時以此正規化形＋指紋比對，偵測上游修正（對抗式審查 P2：
// 冪等不能只防覆寫本地補件，也要能看見上游改了什麼）。
export function normalizeUpstreamFields(handoffOpp) {
  return {
    opportunityName: handoffOpp.opportunityName || '',
    estRevenue: handoffOpp.estRevenue || 0,
    currency: handoffOpp.currency || 'TWD',
    sourceToolCodes: handoffOpp.sourceToolCodes || [],
    sourceToolNames: handoffOpp.sourceToolNames || [],
    aiScore: handoffOpp.aiScore ?? null,
    template1: handoffOpp.template1 || null,
    template2: handoffOpp.template2 || null,
    template3: handoffOpp.template3 || null,
  };
}

export function upstreamFingerprintOf(handoffOpp) {
  return contentFingerprint(normalizeUpstreamFields(handoffOpp));
}

export function opportunityDocFromHandoff(handoffOpp, index) {
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    no: index + 1,
    sourceId: handoffOpp.id, // 單元三的機會 id（追溯用）
    opportunityName: handoffOpp.opportunityName || '',
    estRevenue: handoffOpp.estRevenue || 0,
    currency: handoffOpp.currency || 'TWD',
    sourceToolCodes: handoffOpp.sourceToolCodes || [],
    sourceToolNames: handoffOpp.sourceToolNames || [],
    aiScore: handoffOpp.aiScore ?? null,
    template1: handoffOpp.template1 || null,
    template2: handoffOpp.template2 || null,
    template3: handoffOpp.template3 || null,
    origin: 'handoff', // handoff＝承接自第三堂；manual＝後援手動建立（FR-02-05）
    // 可評估性補件欄位（P-02 就地補錄）
    tam: null, sam: null, som: null,
    growthType: Array.isArray(handoffOpp.template1?.growthType) && handoffOpp.template1.growthType.length
      ? handoffOpp.template1.growthType[0] : '',
    ownerUid: null,
    status: 'imported', // imported → ready → scored → shortlisted/excluded → in_play/reserve
    shortlist: { included: false, reason: '', decidedBy: null, decidedAt: null },
    excluded: { flag: false, reason: '', decidedBy: null, decidedAt: null }, // 不再列為優先（保留池，不刪除）
    createdAt: Date.now(),
    // 上游修正偵測（重同步用）
    upstreamFingerprint: upstreamFingerprintOf(handoffOpp),
    staleUpstream: null,   // { at } 上游已修正、待人工處置
    upstreamPending: null, // 上游修正後的欄位快照（「套用上游新值」的來源）
  };
  doc.qualityFlags = computeOpportunityFlags(doc);
  return doc;
}

// 後援：第三堂尚未交付時手動建立長清單（FR-02-05 / EMP-02）
export function createManualOpportunity(name, index) {
  const doc = opportunityDocFromHandoff({
    id: `manual-${Date.now()}-${index}`,
    opportunityName: name || '',
    estRevenue: 0,
    currency: 'TWD',
    sourceToolCodes: [],
    sourceToolNames: [],
    aiScore: null,
    template1: null, template2: null, template3: null,
  }, index);
  return { ...doc, origin: 'manual' };
}

// ── 策略方案（plays 子集合）──────────────────────────────────────────────────

const splitLines = (s) => String(s || '')
  .split(/\n|；|;/)
  .map((x) => x.trim())
  .filter(Boolean);

// GR-6 底稿指紋：確認時內容若與底稿指紋相同＝未經編輯，記入稽核提醒
export function contentFingerprint(content) {
  const str = JSON.stringify(content ?? null);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}

// 自來源機會自動彙整三模板底稿（FR-06-05）；prefix 標示來源，供人工重整。
export function buildTemplateDrafts(sourceOpps) {
  const opps = sourceOpps || [];
  const label = (o) => (opps.length > 1 ? `【${o.opportunityName || '未命名'}】` : '');
  const collect = (pick) => opps.flatMap((o) => splitLines(pick(o)).map((line) => `${label(o)}${line}`));

  const toolCodes = [...new Set(opps.flatMap((o) => o.sourceToolCodes || []))];
  const toolNames = [...new Set(opps.flatMap((o) => o.sourceToolNames || []))];

  const t1 = {
    companyType: opps[0]?.template1?.companyType || '',
    growthDimension: opps[0]?.template1?.growthDimension || '',
    growthType: [...new Set(opps.flatMap((o) => o.template1?.growthType || []))],
    growthLever: opps[0]?.template1?.growthLever || '',
    usedToolCodes: toolCodes,
    usedToolNames: toolNames,
    insights: collect((o) => o.template1?.insights),
  };
  const t2 = {
    concept: opps.map((o) => String(o.template2?.concept || '').trim()).filter(Boolean).join('\n'),
    method: opps.map((o) => String(o.template2?.method || '').trim()).filter(Boolean).join('\n'),
    targetCustomers: collect((o) => o.template2?.targetCustomer),
    goToMarket: collect((o) => {
      const g = o.template2?.goToMarket || {};
      return [g.rnd, g.production, g.pricing, g.marketing, g.channel, g.logistics, g.afterSales]
        .filter(Boolean).join('\n') || o.template2?.goToMarketStrategy;
    }),
    usp: collect((o) => o.template2?.usp),
    steps: collect((o) => o.template2?.steps || o.template2?.implementationSteps),
  };
  const t3 = {
    ebitBand: opps[0]?.template3?.ebitBand || '',
    cagrBand: opps[0]?.template3?.cagrBand || '',
    currentScale: opps.map((o) => String(o.template3?.currentScale || o.template3?.marketSize || '').trim()).filter(Boolean).join('\n'),
    growthPotential: opps.map((o) => String(o.template3?.cagr || '').trim()).filter(Boolean).join('\n'),
    competitiveEnvironment: opps.map((o) => String(o.template3?.competitiveEnvironment || '').trim()).filter(Boolean).join('\n'),
    topBrandsShare: opps.map((o) => String(o.template3?.topBrandsShare || '').trim()).filter(Boolean).join('\n'),
    synergies: [],
    requiredInvestment: collect((o) => o.template3?.requiredInvestment),
    potentialHurdles: collect((o) => o.template3?.potentialHurdles),
    successFactors: collect((o) => o.template3?.successFactors),
    coreCapabilities: collect((o) => o.template3?.coreCapabilities),
  };
  return { t1, t2, t3 };
}

export function createPlayDoc({ name, formation, mergeCriteria, extendTheme, sourceOppIds, ownerUid, oneLiner }, sourceOpps, { forecastYears = 3 } = {}) {
  const drafts = buildTemplateDrafts(sourceOpps);
  const wrap = (content) => ({
    content,
    confirmed: false,
    draftFingerprint: contentFingerprint(content), // GR-6：底稿未編輯即確認 → 稽核提醒
    confirmedBy: null,
    confirmedAt: null,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    name: name || '',
    formation: formation || 'merge', // merge＝整合而成；extend＝延伸而成
    mergeCriteria: mergeCriteria || [], // 整合判準（≥1）：共同價值主張/共同能力優勢/執行綜效相依
    extendTheme: extendTheme || '',     // 延伸主題（延伸時必填）
    sourceOppIds: sourceOppIds || [],
    ownerUid: ownerUid || null,
    oneLiner: oneLiner || '',
    status: 'draft', // draft → templates_pending → templates_confirmed → bizplan → approved → delivered
    templates: { t1: wrap(drafts.t1), t2: wrap(drafts.t2), t3: wrap(drafts.t3) },
    bizplan: {
      fin: createEmptyFin(forecastYears),
      risks: [],       // { risk, likelihood, impact, mitigation }
      resources: { fte: '', capital: '', mgmtAttention: '' },
      ksf: { threshold: [], winning: [] }, // 基本門檻 vs 成功關鍵，分列
      feasibility: {
        resources: { answer: '', note: '' },   // 所需資源是否存在／可取得
        regulation: { answer: '', note: '' },  // 是否有重大法規限制
        culture: { answer: '', note: '' },     // 現有文化與組織是否支持
        time: { answer: '', note: '' },        // 是否具備足夠時間
      },
      disputes: [], // R-FIN 爭議標記 { cellRef, note, by, at, resolved }
    },
    sequencing: { startYear: 1, endYear: 1, dependsOn: [] },
    createdAt: Date.now(),
  };
}

export const MERGE_CRITERIA_OPTIONS = Object.freeze([
  '共同的價值主張或主題',
  '可運用的共同能力或優勢',
  '執行有綜效或相互依存關係',
]);

// ── 假設（assumptions 子集合，P-16）──────────────────────────────────────────
export function createAssumptionDoc({ text, targetRef, targetLabel, source, confidence, authorUid, authorName }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    text: text || '',
    target: { ref: targetRef || null, label: targetLabel || '' },
    source: source || '專家判斷', // 內部資料/公開資料/專家判斷/AI 假說
    confidence: confidence || 'medium', // high/medium/low
    status: 'unverified', // unverified → verifying → verified / refuted
    evidence: [], // { method, sampleSize, date, conclusion }
    authorUid: authorUid || null,
    authorName: authorName || '',
    createdAt: Date.now(),
  };
}

// ── 文件大小護欄 ─────────────────────────────────────────────────────────────
// Firestore 單文件上限 1 MiB。play 文件（templates+bizplan 同倉）與交付快照
// （複製全部方案內容）理論上可能撞上限——凍結/儲存前估算並擋下，
// 給明確錯誤而非讓 Firestore 寫入炸出難懂的 INVALID_ARGUMENT。
export const FIRESTORE_DOC_SOFT_LIMIT = 900_000; // bytes，留 ~12% 餘裕

export function approxJsonBytes(obj) {
  const str = JSON.stringify(obj ?? null);
  // TextEncoder 以 UTF-8 計位元組（中文 3 bytes/字），比 str.length 準確
  return new TextEncoder().encode(str).length;
}

// ── 交付快照（handoffs 子集合；建立後不可變）──────────────────────────────────
export function buildEvalHandoffSnapshot({ project, opportunities, plays, rollup, totalsTable, checkRun }, version) {
  return {
    version,
    frozenAt: Date.now(),
    projectName: project?.name || '',
    targetSnapshot: project?.targetSnapshot || null,
    settings: project?.settings || null,
    synergies: project?.synergies || null,
    consensus: project?.consensus || null,
    shortlist: (opportunities || [])
      .filter((o) => o.shortlist?.included)
      .map((o) => ({ id: o.id, opportunityName: o.opportunityName, tam: o.tam, sam: o.sam, som: o.som })),
    plays: (plays || []).map((p) => ({
      id: p.id,
      name: p.name,
      formation: p.formation,
      mergeCriteria: p.mergeCriteria,
      extendTheme: p.extendTheme,
      sourceOppIds: p.sourceOppIds,
      oneLiner: p.oneLiner,
      templates: {
        t1: p.templates?.t1?.content || null,
        t2: p.templates?.t2?.content || null,
        t3: p.templates?.t3?.content || null,
      },
      bizplan: p.bizplan || null,
      sequencing: p.sequencing || null,
    })),
    rollup: rollup || null,
    yearlyTotals: totalsTable || null,
    checkRun: checkRun || null,
  };
}

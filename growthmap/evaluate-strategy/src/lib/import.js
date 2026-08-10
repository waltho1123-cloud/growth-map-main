// 承接上游（FR-12-01/02）：讀「自己的」單元三交付快照與單元二差距核心值。
// 欄位契約一律走 @growthmap/contracts——勿在此直接讀字面欄位名。

import {
  APP_KEYS, userAppDocSegments,
  extractHandoffSnapshot, listHandoffVersions, extractOrientSnapshot,
} from '@growthmap/contracts';
import { getUserAppDoc, batchSetSubDocs, getSubDocs, updateProject, updateSubDoc } from './db';
import { opportunityDocFromHandoff, normalizeUpstreamFields, upstreamFingerprintOf } from '../domain/model';
import { computeOpportunityFlags } from '../domain/guards';

// 單元一～三雲端文件形狀：{ data, updatedAtMs, ... }（@growthmap/cloud 寫入）
async function loadAppData(uid, appKey) {
  const cloudDoc = await getUserAppDoc(userAppDocSegments(uid, appKey));
  return cloudDoc && typeof cloudDoc === 'object' ? cloudDoc.data ?? null : null;
}

// 列出可承接的交付快照版本（P-02 承接對話框）
export async function listMyHandoffVersions(uid) {
  const data = await loadAppData(uid, APP_KEYS.opportunity);
  return listHandoffVersions(data);
}

// 第二堂差距後援：快照缺 targetSnapshot 時改讀 apps/aspiration
async function loadOrientFallback(uid) {
  const data = await loadAppData(uid, APP_KEYS.aspiration);
  if (!data) return null;
  const core = extractOrientSnapshot(data);
  if (!core || !core.contractOk) return null;
  return {
    aspiration: core.aspiration,
    momentum: core.momentum,
    growthGap: core.growthGap,
    currency: 'TWD',
  };
}

// 承接單元三交付快照 → opportunities 子集合＋專案來源中繼資料。
// 冪等語意（對抗式審查後修訂）：文件 id 固定為 imp-{sourceId}；「重新同步」
// (1) 補進新機會；(2) 不覆寫既有列（補件與短名單決策不可被上游重灌沖掉）；
// (3) 以上游指紋偵測「上游修正版」→ 標記 staleUpstream ＋ 存 upstreamPending，
//     由使用者在 P-02 逐列決定「套用上游新值」或「保留本地版」（人工合併）。
export async function importHandoff(pid, uid, version = null) {
  const data = await loadAppData(uid, APP_KEYS.opportunity);
  const snapshot = extractHandoffSnapshot(data, version);
  if (!snapshot) {
    return { ok: false, code: 'NO_SNAPSHOT', message: '第三堂尚未交付長清單快照。可先手動建立長清單，之後再同步。' };
  }

  const existingDocs = await getSubDocs(pid, 'opportunities');
  const existingById = new Map(existingDocs.map((docu) => [docu.id, docu]));
  let nextNo = existingDocs.reduce((max, docu) => Math.max(max, docu.no || 0), 0);

  const entries = [];
  let staleMarked = 0;
  for (const o of snapshot.opportunities) {
    const id = `imp-${o.id}`;
    const cur = existingById.get(id);
    if (!cur) {
      entries.push({ id, data: opportunityDocFromHandoff(o, nextNo) });
      nextNo += 1;
      continue;
    }
    // 既有列：比對上游指紋；不同＝上游修正 → 只標記，不動本地內容
    const newFp = upstreamFingerprintOf(o);
    if (cur.upstreamFingerprint !== newFp && cur.staleUpstream?.fingerprint !== newFp) {
      await updateSubDoc(pid, 'opportunities', id, {
        staleUpstream: { at: Date.now(), fingerprint: newFp, fromVersion: snapshot.version },
        upstreamPending: normalizeUpstreamFields(o),
      });
      staleMarked += 1;
    }
  }
  if (entries.length > 0) {
    await batchSetSubDocs(pid, 'opportunities', entries);
  }

  const targetSnapshot = snapshot.targetSnapshot || await loadOrientFallback(uid);
  await updateProject(pid, {
    source: {
      version: snapshot.version,
      frozenAt: snapshot.frozenAt,
      archetype: snapshot.archetype,
      importedAt: Date.now(),
      importedBy: uid,
      contractOk: snapshot.contractOk,
      violations: snapshot.violations,
    },
    ...(targetSnapshot ? { targetSnapshot } : {}),
    stage: 'evaluate',
  });

  return {
    ok: true,
    imported: entries.length,
    skipped: snapshot.opportunities.length - entries.length - staleMarked,
    staleMarked, // 上游修正、已標記待人工處置的既有列數
    contractOk: snapshot.contractOk,
    violations: snapshot.violations,
    hasTarget: !!targetSnapshot,
  };
}

// P-02「套用上游新值」：以 upstreamPending 覆寫上游欄位，保留本地評估欄位
// （tam/sam/som/負責人/短名單/排除決策/彙總分數）；同時重算品質旗標。
export async function applyUpstreamUpdate(pid, opp) {
  const pending = opp?.upstreamPending;
  if (!pending) return;
  await updateSubDoc(pid, 'opportunities', opp.id, {
    ...pending,
    upstreamFingerprint: opp.staleUpstream?.fingerprint || null,
    staleUpstream: null,
    upstreamPending: null,
    qualityFlags: computeOpportunityFlags({ ...opp, ...pending }),
  });
}

// P-02「保留本地版」：清除標記，記住已看過這個上游版本（同版本不再重複標記）
export async function dismissUpstreamUpdate(pid, opp) {
  await updateSubDoc(pid, 'opportunities', opp.id, {
    upstreamFingerprint: opp.staleUpstream?.fingerprint || opp.upstreamFingerprint || null,
    staleUpstream: null,
    upstreamPending: null,
  });
}

// 僅刷新第二堂差距核心值（P-01 儀表「重新同步」）
export async function refreshTargetSnapshot(pid, uid) {
  const target = await loadOrientFallback(uid);
  if (!target) return { ok: false, message: '讀不到第二堂資料（或契約違約）。' };
  await updateProject(pid, { targetSnapshot: target });
  return { ok: true };
}

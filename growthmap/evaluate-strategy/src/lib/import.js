// 承接上游（FR-12-01/02）：讀「自己的」單元三交付快照與單元二差距核心值。
// 欄位契約一律走 @growthmap/contracts——勿在此直接讀字面欄位名。

import {
  APP_KEYS, userAppDocSegments,
  extractHandoffSnapshot, listHandoffVersions, extractOrientSnapshot,
} from '@growthmap/contracts';
import { getUserAppDoc, batchSetSubDocs, getSubDocIds, updateProject } from './db';
import { opportunityDocFromHandoff } from '../domain/model';

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
// 冪等語意：文件 id 固定為 imp-{sourceId}，「重新同步」只補新機會，
// 不覆寫既有文件（既有列上的補件與短名單決策不可被上游重灌沖掉）。
export async function importHandoff(pid, uid, version = null) {
  const data = await loadAppData(uid, APP_KEYS.opportunity);
  const snapshot = extractHandoffSnapshot(data, version);
  if (!snapshot) {
    return { ok: false, code: 'NO_SNAPSHOT', message: '第三堂尚未交付長清單快照。可先手動建立長清單，之後再同步。' };
  }

  const existing = new Set(await getSubDocIds(pid, 'opportunities'));
  const entries = snapshot.opportunities
    .map((o, i) => ({ id: `imp-${o.id}`, data: opportunityDocFromHandoff(o, i) }))
    .filter((e) => !existing.has(e.id));
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
    skipped: snapshot.opportunities.length - entries.length,
    contractOk: snapshot.contractOk,
    violations: snapshot.violations,
    hasTarget: !!targetSnapshot,
  };
}

// 僅刷新第二堂差距核心值（P-01 儀表「重新同步」）
export async function refreshTargetSnapshot(pid, uid) {
  const target = await loadOrientFallback(uid);
  if (!target) return { ok: false, message: '讀不到第二堂資料（或契約違約）。' };
  await updateProject(pid, { targetSnapshot: target });
  return { ok: true };
}

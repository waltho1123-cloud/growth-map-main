#!/usr/bin/env node
// 事故還原 CLI（服務帳號，容器內以 zeabur service exec 執行）：
//   node scripts/firestore-restore.mjs <docPath> <readTime ISO> [--apply]
// 讀取 readTime 當下的文件版本（Firestore 版本保留期內：無 PITR 為 1 小時），印摘要；
// 帶 --apply 才寫回：先把舊版本存一份到 restoreBackups/{sanitized}_{ts}，再整份覆寫目標文件，
// 並把 updatedAtMs／updatedAt 設為現在、writer='restore-cli'——讓所有 client 的 reconcile 判定「雲端較新」
// 而套用還原版，而不是用它們手上（可能是造成事故的）本機狀態再覆寫一次。
import { readFileSync } from 'node:fs';
import { parseServiceAccount, createAdminTokenProvider } from '../src/service-account.js';
import { createFirestoreAdminClient } from '../src/admin-firestore.js';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8') : '');
const sa = parseServiceAccount(raw);
if (!sa) { console.error('缺少 FIREBASE_SERVICE_ACCOUNT_JSON'); process.exit(2); }
const projectId = process.env.FIREBASE_PROJECT_ID || sa.projectId;
const fs = createFirestoreAdminClient({ projectId, getAccessToken: createAdminTokenProvider(sa).getAccessToken });

const [docPath, readTime, ...flags] = process.argv.slice(2);
if (!docPath || !readTime) { console.error('用法：node scripts/firestore-restore.mjs <docPath> <readTime ISO> [--apply]'); process.exit(2); }
const apply = flags.includes('--apply');

const num = (v) => (v?.integerValue != null ? Number(v.integerValue) : v?.doubleValue != null ? v.doubleValue : null);
const arrLen = (v) => (v?.arrayValue?.values || []).length;
const mapKeys = (v) => Object.keys(v?.mapValue?.fields || {});
function summarize(doc, label) {
  const f = doc?.fields || {};
  const data = f.data?.mapValue?.fields || {};
  console.log(`--- ${label} ---`);
  console.log('updateTime:', doc?.updateTime, '| updatedAtMs:', num(f.updatedAtMs), f.updatedAtMs ? `(${new Date(num(f.updatedAtMs)).toISOString()})` : '', '| writer:', f.writer?.stringValue, '| version:', num(f.version));
  console.log('data keys:', Object.keys(data).join(','));
  console.log('opportunities:', arrLen(data.opportunities), '| toolAnalyses:', mapKeys(data.toolAnalyses).join(',') || '(none)', '| longlistSnapshots:', arrLen(data.longlistSnapshots), '| lastCheckRun:', data.lastCheckRun ? (data.lastCheckRun.nullValue === null ? 'null' : 'set') : '(absent)');
  console.log('approx bytes:', JSON.stringify(doc?.fields || {}).length);
}

try {
  const current = await fs.getDocumentRaw(docPath);
  summarize(current, 'CURRENT');
  const old = await fs.getDocumentRaw(docPath, { readTime });
  summarize(old, `VERSION @ ${readTime}`);
  if (!apply) { console.log('\n（未帶 --apply，僅檢視）'); process.exit(0); }
  const nowMs = Date.now();
  const backupId = `${docPath.replace(/\//g, '_')}_${nowMs}`;
  await fs.setDocumentRaw(`restoreBackups/${backupId}`, {
    docPath: { stringValue: docPath },
    readTime: { stringValue: readTime },
    restoredAt: { integerValue: String(nowMs) },
    previousCurrent: { mapValue: { fields: current.fields || {} } },
    restored: { mapValue: { fields: old.fields || {} } },
  });
  const fields = { ...(old.fields || {}) };
  fields.updatedAtMs = { integerValue: String(nowMs) };
  fields.updatedAt = { timestampValue: new Date(nowMs).toISOString() };
  fields.writer = { stringValue: 'restore-cli' };
  const written = await fs.setDocumentRaw(docPath, fields);
  console.log(`\n已寫回。backup: restoreBackups/${backupId}`);
  summarize(written, 'AFTER RESTORE');
} catch (e) {
  console.error('失敗：', e?.message || e);
  process.exit(1);
}

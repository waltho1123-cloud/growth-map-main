#!/usr/bin/env node
// 一次性維運 CLI（不需登入管理頁）。在 Zeabur 後端容器內以 `zeabur service exec` 執行
//（金鑰不離開 Zeabur），或本機以 FIREBASE_SERVICE_ACCOUNT_FILE 指向金鑰檔。
//   node scripts/auth-admin.mjs status                 顯示登入方式設定
//   node scripts/auth-admin.mjs configure              啟用 Email/Password、關閉自助註冊
//   node scripts/auth-admin.mjs list                   列出全部帳號
//   NEW_PASSWORD=... node scripts/auth-admin.mjs set-password <email>   設密碼（並標 email 已驗證）
//   node scripts/auth-admin.mjs verify-email <email>   標記 email 已驗證
//   node scripts/auth-admin.mjs delete <email> [--purge-data]   刪帳號（＋platformUsers 目錄項；--purge-data 連工作簿資料）
import { readFileSync } from 'node:fs';
import { parseServiceAccount, createAdminTokenProvider } from '../src/service-account.js';
import { createIdentityToolkitClient, validateEmail, validatePassword } from '../src/admin-accounts.js';
import { createFirestoreAdminClient } from '../src/admin-firestore.js';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8') : '');
const sa = parseServiceAccount(raw);
if (!sa) {
  console.error('缺少或無法解析 FIREBASE_SERVICE_ACCOUNT_JSON（或 FIREBASE_SERVICE_ACCOUNT_FILE）');
  process.exit(2);
}
const projectId = process.env.FIREBASE_PROJECT_ID || sa.projectId;
const tokenProvider = createAdminTokenProvider(sa);
const client = createIdentityToolkitClient({ projectId, getAccessToken: tokenProvider.getAccessToken });
const firestoreAdmin = createFirestoreAdminClient({ projectId, getAccessToken: tokenProvider.getAccessToken });
const [cmd, arg, ...flags] = process.argv.slice(2);

const fmt = (ms) => (ms ? new Date(ms).toISOString() : '-');
async function findByEmail(email) {
  const u = await client.lookupByEmail(validateEmail(email));
  if (!u) throw new Error(`找不到帳號：${email}`);
  return u;
}

try {
  switch (cmd) {
    case 'status': {
      console.log(JSON.stringify({ projectId, serviceAccount: sa.clientEmail, ...(await client.getAuthConfig()) }, null, 2));
      break;
    }
    case 'configure': {
      const before = await client.getAuthConfig();
      const after = await client.applyAuthConfig({ emailPassword: true, disableSignup: true });
      console.log(JSON.stringify({ before, after }, null, 2));
      break;
    }
    case 'list': {
      const list = await client.listAccounts();
      for (const u of list) {
        console.log(`${u.email}\t${u.providers.join('+') || '-'}\tverified=${u.emailVerified}\tdisabled=${u.disabled}\tlastLogin=${fmt(u.lastLoginAt)}\t${u.uid}`);
      }
      console.log(`${list.length} 個帳號`);
      break;
    }
    case 'set-password': {
      if (!arg) throw new Error('用法：NEW_PASSWORD=... node scripts/auth-admin.mjs set-password <email>');
      const pw = validatePassword(process.env.NEW_PASSWORD);
      const u = await findByEmail(arg);
      await client.setPassword(u.uid, pw);
      console.log(`已設定 ${u.email} 的密碼（email 標為已驗證）`);
      break;
    }
    case 'verify-email': {
      if (!arg) throw new Error('用法：node scripts/auth-admin.mjs verify-email <email>');
      const u = await findByEmail(arg);
      await client.setEmailVerified(u.uid, true);
      console.log(`已標記 ${u.email} 為 email 已驗證`);
      break;
    }
    case 'delete': {
      if (!arg) throw new Error('用法：node scripts/auth-admin.mjs delete <email> [--purge-data]');
      const u = await findByEmail(arg);
      await client.deleteAccount(u.uid);
      await firestoreAdmin.deleteDocument(`platformUsers/${u.uid}`);
      const purged = flags.includes('--purge-data') ? await firestoreAdmin.purgeUserData(u.uid) : 0;
      console.log(`已刪除 ${u.email}（${u.uid}）；platformUsers 目錄項已刪；工作簿文件刪除 ${purged} 份`);
      break;
    }
    default:
      console.error('用法：node scripts/auth-admin.mjs <status|configure|list|set-password <email>|verify-email <email>|delete <email> [--purge-data]>');
      process.exit(2);
  }
} catch (e) {
  console.error('失敗：', e?.message || e);
  process.exit(1);
}

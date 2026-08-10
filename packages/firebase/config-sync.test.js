// 漂移守衛：portal 的 js/portal-auth.js（無建置頁，config 為複本）必須與
// 本包 firebaseConfig 完全一致。改 config 忘了同步兩處 → 本測試紅燈。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { firebaseConfig } from './index.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('portal-auth.js 的 Firebase config 與 @growthmap/firebase 一致（複本防漂移）', () => {
  const src = readFileSync(join(repoRoot, 'js', 'portal-auth.js'), 'utf8');
  for (const [key, value] of Object.entries(firebaseConfig)) {
    const re = new RegExp(`${key}:\\s*'([^']*)'`);
    const m = src.match(re);
    assert.ok(m, `portal-auth.js 缺少 ${key}`);
    assert.equal(m[1], value, `portal-auth.js 的 ${key} 與 packages/firebase 不一致`);
  }
});

test('portal-auth.js 的 CDN Firebase 版本與 workspace 安裝版一致（SDK 行為防漂移）', () => {
  const src = readFileSync(join(repoRoot, 'js', 'portal-auth.js'), 'utf8');
  const matches = [...src.matchAll(/firebasejs\/(\d+\.\d+\.\d+)\//g)].map((m) => m[1]);
  assert.ok(matches.length >= 2, 'portal-auth.js 應有 firebase-app 與 firebase-auth 兩個 CDN import');
  const installed = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules', 'firebase', 'package.json'), 'utf8')
  ).version;
  for (const v of matches) {
    assert.equal(v, installed,
      `portal CDN 版本 ${v} ≠ 安裝版 ${installed}——npm 升級 firebase 後，js/portal-auth.js 的兩個 CDN URL 要一起改`);
  }
});

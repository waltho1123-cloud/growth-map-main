// 漂移守衛：portal 層的 Firebase 複本（js/firebase-config.js）必須與本包正本一致，
// 且 CDN ESM 的 SDK 版本必須等於 workspace 實際安裝版。
// 改 config 忘了同步、npm 升級 firebase 忘了改 CDN URL → 本測試紅燈。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { firebaseConfig } from './index.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(repoRoot, ...p), 'utf8');

test('js/firebase-config.js 的 config 與 @growthmap/firebase 一致（複本防漂移）', () => {
  const src = read('js', 'firebase-config.js');
  for (const [key, value] of Object.entries(firebaseConfig)) {
    const m = src.match(new RegExp(`${key}:\\s*'([^']*)'`));
    assert.ok(m, `js/firebase-config.js 缺少 ${key}`);
    assert.equal(m[1], value, `js/firebase-config.js 的 ${key} 與 packages/firebase 不一致`);
  }
});

test('portal 層 CDN Firebase 版本與 workspace 安裝版一致（SDK 行為防漂移）', () => {
  const installed = JSON.parse(read('node_modules', 'firebase', 'package.json')).version;

  const cfg = read('js', 'firebase-config.js');
  const declared = cfg.match(/FIREBASE_SDK_VERSION = '(\d+\.\d+\.\d+)'/);
  assert.ok(declared, 'js/firebase-config.js 缺少 FIREBASE_SDK_VERSION');
  assert.equal(declared[1], installed, 'FIREBASE_SDK_VERSION 需等於 node_modules/firebase 安裝版');

  // 兩個無建置頁的 CDN import 都要對版
  for (const file of ['portal-auth.js', 'platform-admin.js']) {
    const src = read('js', file);
    const versions = [...src.matchAll(/firebasejs\/(\d+\.\d+\.\d+)\//g)].map((m) => m[1]);
    assert.ok(versions.length >= 2, `${file} 應有 firebase-app 與 firebase-auth/firestore 的 CDN import`);
    for (const v of versions) {
      assert.equal(v, installed, `${file} CDN 版本 ${v} ≠ 安裝版 ${installed}——URL 要一起改`);
    }
  }
});

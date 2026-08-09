import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, createCloudSync } from './index.js';

test('reconcile：本 session 未動（localTs=0）→ 有雲端取雲端、無雲端不動', () => {
  assert.equal(reconcile(0, { data: {}, updatedAt: 100, version: 1 }), 'cloud');
  assert.equal(reconcile(0, null), 'same');
});

test('reconcile：本地有改動且無雲端 → 上傳', () => {
  assert.equal(reconcile(500, null), 'upload');
});

test('reconcile：雲端較新 → 取雲端', () => {
  assert.equal(reconcile(500, { data: {}, updatedAt: 900, version: 1 }), 'cloud');
});

test('reconcile：本地較新 → 上傳', () => {
  assert.equal(reconcile(900, { data: {}, updatedAt: 500, version: 1 }), 'upload');
});

test('reconcile：同毫秒碰撞偏向保留本地（opportunity 修正版，非舊版 same）', () => {
  assert.equal(reconcile(700, { data: {}, updatedAt: 700, version: 1 }), 'upload');
});

test('createCloudSync：db 不可用時 load 回 null、save 靜默略過', async () => {
  const sync = createCloudSync(async () => ({ db: null }));
  assert.equal(await sync.loadCloud('u1', 'momentum'), null);
  await assert.doesNotReject(sync.saveCloud('u1', 'momentum', { x: 1 }));
});

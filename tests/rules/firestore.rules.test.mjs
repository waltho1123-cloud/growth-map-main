// firestore.rules 自動化測試（Firestore 模擬器＋@firebase/rules-unit-testing）。
// 跑法：`npm run test:rules`（需 Java 21；CI 的 preflight workflow 會跑）。
// 覆蓋 2026-08-10 對抗式審查與 2026-09-08 email_verified 守門的關鍵不變式，防回歸。
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const ROOT = 'waltho1123@gmail.com'; // 與 firestore.rules 的 root 常數一致
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-growth-map-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const asUser = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const project = (ownerUid, extra = {}) => ({
  name: 'P', memberUids: [ownerUid], members: { [ownerUid]: { role: 'owner' } },
  invitedEmails: [], inviteRoles: {}, createdAt: 1, ...extra,
});

test('platformUsers：本人可建檔（白名單欄位、blocked=false）；不得建別人的、不得自封 blocked、不得帶多餘欄位', async () => {
  const u1 = asUser('u1', 'u1@x.y');
  await assertSucceeds(setDoc(doc(u1, 'platformUsers/u1'), {
    email: 'u1@x.y', emailVerified: true, displayName: '', photoURL: '', firstSeenAt: 1, lastSeenAt: 1, lastPath: '/', blocked: false,
  }));
  await assertFails(setDoc(doc(u1, 'platformUsers/u2'), { email: 'u2@x.y', blocked: false }));
  await assertFails(setDoc(doc(asUser('u3', 'u3@x.y'), 'platformUsers/u3'), { email: 'u3@x.y', blocked: true }));
  await assertFails(setDoc(doc(asUser('u4', 'u4@x.y'), 'platformUsers/u4'), { email: 'u4@x.y', blocked: false, role: 'admin' }));
});

test('platformUsers：本人只能更新活動欄位；管理員只能切換 blocked', async () => {
  await seed((db) => setDoc(doc(db, 'platformUsers/u1'), { email: 'u1@x.y', blocked: false, firstSeenAt: 1, lastSeenAt: 1 }));
  const me = asUser('u1', 'u1@x.y');
  await assertSucceeds(updateDoc(doc(me, 'platformUsers/u1'), { lastSeenAt: 2, lastPath: '/x' }));
  await assertFails(updateDoc(doc(me, 'platformUsers/u1'), { blocked: true }));
  const admin = asUser('admin', ROOT);
  await assertSucceeds(updateDoc(doc(admin, 'platformUsers/u1'), { blocked: true, blockedAt: 3, blockedBy: ROOT }));
  await assertFails(updateDoc(doc(admin, 'platformUsers/u1'), { lastPath: '/hack' }));
});

test('管理員身分要求 email_verified：root email 未驗證＝不是管理員；非管理員讀不到別人的目錄', async () => {
  await seed((db) => setDoc(doc(db, 'platformUsers/u1'), { email: 'u1@x.y', blocked: false }));
  const verified = asUser('admin', ROOT, true);
  const unverified = asUser('admin2', ROOT, false);
  await assertSucceeds(getDoc(doc(verified, 'platform/meta')));
  await assertFails(getDoc(doc(unverified, 'platform/meta')));
  await assertSucceeds(getDoc(doc(verified, 'platformUsers/u1')));
  await assertFails(getDoc(doc(unverified, 'platformUsers/u1')));
  await assertFails(getDoc(doc(asUser('u9', 'u9@x.y'), 'platformUsers/u1')));
});

test('platform/meta 增補的管理員生效，且同樣要求 email_verified', async () => {
  await seed((db) => setDoc(doc(db, 'platform/meta'), { adminEmails: ['second@x.y'] }));
  await assertSucceeds(getDoc(doc(asUser('s1', 'second@x.y', true), 'platform/meta')));
  await assertFails(getDoc(doc(asUser('s2', 'second@x.y', false), 'platform/meta')));
});

test('users/{uid}/apps：本人可讀寫；他人不可；被封鎖者可讀不可寫', async () => {
  await seed((db) => setDoc(doc(db, 'platformUsers/b1'), { email: 'b1@x.y', blocked: true }));
  await assertSucceeds(setDoc(doc(asUser('u1', 'u1@x.y'), 'users/u1/apps/momentum'), { data: {} }));
  await assertFails(setDoc(doc(asUser('u2', 'u2@x.y'), 'users/u1/apps/momentum'), { data: {} }));
  await assertFails(getDoc(doc(asUser('u2', 'u2@x.y'), 'users/u1/apps/momentum')));
  await assertFails(setDoc(doc(asUser('b1', 'b1@x.y'), 'users/b1/apps/momentum'), { data: {} }));
  await assertSucceeds(getDoc(doc(asUser('b1', 'b1@x.y'), 'users/b1/apps/momentum')));
});

test('evalProjects：建立者必須是唯一成員且 owner；成員可讀、非成員不可', async () => {
  const owner = asUser('o1', 'o1@x.y');
  await assertSucceeds(setDoc(doc(owner, 'evalProjects/p1'), project('o1')));
  await assertFails(setDoc(doc(owner, 'evalProjects/p2'), project('someone-else')));
  await assertFails(setDoc(doc(owner, 'evalProjects/p3'), { ...project('o1'), members: { o1: { role: 'editor' } } }));
  await assertSucceeds(getDoc(doc(owner, 'evalProjects/p1')));
  await assertFails(getDoc(doc(asUser('x', 'x@x.y'), 'evalProjects/p1')));
});

test('邀請：受邀者 email 已驗證才可讀；自助加入只能消耗自己的邀請、角色鎖 inviteRoles、不得自封 owner', async () => {
  await seed((db) => setDoc(doc(db, 'evalProjects/p1'), project('o1', { invitedEmails: ['inv@x.y'], inviteRoles: { 'inv@x.y': 'editor' } })));
  await assertSucceeds(getDoc(doc(asUser('i1', 'inv@x.y', true), 'evalProjects/p1')));
  await assertFails(getDoc(doc(asUser('i2', 'inv@x.y', false), 'evalProjects/p1')));
  const me = asUser('i1', 'inv@x.y', true);
  const join = (role) => updateDoc(doc(me, 'evalProjects/p1'), {
    memberUids: ['o1', 'i1'], members: { o1: { role: 'owner' }, i1: { role } }, invitedEmails: [], inviteRoles: {},
  });
  await assertFails(join('owner'));
  await assertSucceeds(join('editor'));
});

test('一般成員不得動 membership 欄位（自我提權／移除他人），但可編輯業務欄位', async () => {
  await seed((db) => setDoc(doc(db, 'evalProjects/p1'), project('o1', {
    memberUids: ['o1', 'e1'], members: { o1: { role: 'owner' }, e1: { role: 'editor' } },
  })));
  const editor = asUser('e1', 'e1@x.y');
  await assertSucceeds(updateDoc(doc(editor, 'evalProjects/p1'), { name: 'renamed' }));
  await assertFails(updateDoc(doc(editor, 'evalProjects/p1'), { members: { o1: { role: 'owner' }, e1: { role: 'owner' } } }));
  await assertFails(updateDoc(doc(editor, 'evalProjects/p1'), { memberUids: ['e1'] }));
});

test('scores：docId 必須綁 {oppId}__r{round}__{uid}、輪次須開放；coach 不可寫', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'evalProjects/p1'), project('o1', {
      memberUids: ['o1', 'e1', 'c1'], members: { o1: { role: 'owner' }, e1: { role: 'editor' }, c1: { role: 'coach' } },
    }));
    await setDoc(doc(db, 'evalProjects/p1/rounds/1'), { n: 1, status: 'open' });
    await setDoc(doc(db, 'evalProjects/p1/rounds/2'), { n: 2, status: 'closed' });
  });
  const e1 = asUser('e1', 'e1@x.y');
  const score = (round) => ({ oppId: 'opp1', round, scorerUid: 'e1', submitted: false });
  await assertSucceeds(setDoc(doc(e1, 'evalProjects/p1/scores/opp1__r1__e1'), score(1)));
  await assertFails(setDoc(doc(e1, 'evalProjects/p1/scores/opp1__r1__someone'), score(1)));
  await assertFails(setDoc(doc(e1, 'evalProjects/p1/scores/opp1__r2__e1'), score(2)));
  await assertFails(setDoc(doc(asUser('c1', 'c1@x.y'), 'evalProjects/p1/scores/opp1__r1__c1'), { ...score(1), scorerUid: 'c1' }));
});

test('adminLogs：client 不得寫入（連管理員也不行）；只有管理員可讀', async () => {
  await seed((db) => setDoc(doc(db, 'adminLogs/l1'), { at: 1, action: 'create' }));
  await assertFails(setDoc(doc(asUser('admin', ROOT), 'adminLogs/l2'), { at: 2 }));
  await assertSucceeds(getDoc(doc(asUser('admin', ROOT), 'adminLogs/l1')));
  await assertFails(getDoc(doc(asUser('u1', 'u1@x.y'), 'adminLogs/l1')));
});

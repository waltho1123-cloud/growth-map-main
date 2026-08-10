import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAllowlist, allowlistEnabled, isEmailAllowed, mergeAllowlists, parseFirestoreAllowlistDoc,
} from './allowlist.js';

test('parseAllowlist：CSV 去空白、轉小寫、網域去前導 @', () => {
  const al = parseAllowlist({
    ALLOWED_EMAILS: ' A@B.com ,, c@d.io ',
    ALLOWED_EMAIL_DOMAINS: '@Example.com, corp.tw',
  });
  assert.deepEqual(al.emails, ['a@b.com', 'c@d.io']);
  assert.deepEqual(al.domains, ['example.com', 'corp.tw']);
});

test('未設定＝不啟用：任何 email（含空）都放行', () => {
  const al = parseAllowlist({});
  assert.equal(allowlistEnabled(al), false);
  assert.equal(isEmailAllowed('anyone@anywhere.com', al), true);
  assert.equal(isEmailAllowed(null, al), true);
});

test('啟用後：精確 email 或網域符合才放行；大小寫不敏感', () => {
  const al = parseAllowlist({ ALLOWED_EMAILS: 'walt@gmail.com', ALLOWED_EMAIL_DOMAINS: 'corp.tw' });
  assert.equal(isEmailAllowed('WALT@Gmail.com', al), true);
  assert.equal(isEmailAllowed('someone@corp.tw', al), true);
  assert.equal(isEmailAllowed('stranger@gmail.com', al), false); // gmail 網域不在名單，僅精確 email
  assert.equal(isEmailAllowed('walt@corp.com.evil.io', al), false);
});

test('啟用後：token 缺 email 一律拒絕（fail-closed on missing claim）', () => {
  const al = parseAllowlist({ ALLOWED_EMAILS: 'walt@gmail.com' });
  assert.equal(isEmailAllowed(null, al), false);
  assert.equal(isEmailAllowed('', al), false);
  assert.equal(isEmailAllowed('not-an-email', al), false);
});

test('僅設網域：子網域不得混過（嚴格比對最後一段網域）', () => {
  const al = parseAllowlist({ ALLOWED_EMAIL_DOMAINS: 'corp.tw' });
  assert.equal(isEmailAllowed('a@corp.tw', al), true);
  assert.equal(isEmailAllowed('a@sub.corp.tw', al), false);
});

test('mergeAllowlists：環境變數保底 ∪ 遠端名單、去重', () => {
  const merged = mergeAllowlists(
    { emails: ['a@x.com'], domains: [] },
    { emails: ['a@x.com', 'b@y.com'], domains: ['corp.tw'] }
  );
  assert.deepEqual(merged, { emails: ['a@x.com', 'b@y.com'], domains: ['corp.tw'] });
  // 遠端為空/未取得 → 等同僅環境變數
  assert.deepEqual(mergeAllowlists({ emails: ['a@x.com'], domains: [] }, null).emails, ['a@x.com']);
});

test('parseFirestoreAllowlistDoc：REST typed value → 名單；缺欄/壞型別回空', () => {
  const doc = {
    fields: {
      emails: { arrayValue: { values: [{ stringValue: ' A@B.com ' }, { stringValue: '' }] } },
      domains: { arrayValue: { values: [{ stringValue: '@Corp.TW' }] } },
    },
  };
  assert.deepEqual(parseFirestoreAllowlistDoc(doc), { emails: ['a@b.com'], domains: ['corp.tw'] });
  assert.deepEqual(parseFirestoreAllowlistDoc({}), { emails: [], domains: [] });
  assert.deepEqual(parseFirestoreAllowlistDoc({ fields: { emails: { stringValue: 'junk' } } }),
    { emails: [], domains: [] });
});

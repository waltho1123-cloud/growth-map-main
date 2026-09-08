// describeAuthError：Firebase 錯誤碼 → 繁中訊息的契約（各單元與 portal 靜態頁都靠這份文案）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAuthError, PASSWORD_RESET_NOTICE, VERIFICATION_NOTICE } from './index.js';

test('帳號枚舉保護下的三種「憑證錯」都翻成同一句，不洩漏帳號是否存在', () => {
  const same = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']
    .map((code) => describeAuthError({ code }));
  assert.equal(new Set(same).size, 1);
  assert.match(same[0], /email 或密碼錯誤/);
});

test('供應商未啟用要指到 Console 的位置（上線前置步驟最常漏）', () => {
  assert.match(describeAuthError({ code: 'auth/operation-not-allowed' }), /Sign-in method/);
});

test('未知錯誤保留原始 code，前綴依動作（verb）而定', () => {
  assert.equal(describeAuthError({ code: 'auth/whatever' }), '登入失敗：auth/whatever');
  assert.equal(describeAuthError({ code: 'auth/whatever' }, '寄送驗證信'), '寄送驗證信失敗：auth/whatever');
  assert.equal(describeAuthError(new Error('boom'), '重新檢查'), '重新檢查失敗：boom');
});

test('提示文案存在且非空', () => {
  assert.ok(PASSWORD_RESET_NOTICE.length > 10);
  assert.ok(VERIFICATION_NOTICE.length > 10);
});

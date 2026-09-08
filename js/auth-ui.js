// Portal 層（無建置的靜態頁：入口站膠囊 js/portal-auth.js、管理頁 js/platform-admin.js）
// 共用的 email／密碼登入 UI 與錯誤翻譯。
// 邏輯正本在 packages/firebase（describeAuthError／useEmailLogin／useEmailVerification）；
// 靜態頁無法 import workspace 包，本檔是等價複本——改錯誤文案兩處一起改。
// CDN URL 的版本字串須與 js/firebase-config.js 的 FIREBASE_SDK_VERSION 一致（config-sync.test 會驗）。

import {
  signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

// Firebase auth 錯誤碼 → 使用者看得懂的繁中訊息。
// 帳號枚舉保護開啟時，密碼錯與帳號不存在都回 invalid-credential——一律同一句。
const AUTH_ERROR_TEXT = {
  'auth/invalid-credential': 'email 或密碼錯誤。',
  'auth/invalid-login-credentials': 'email 或密碼錯誤。',
  'auth/wrong-password': 'email 或密碼錯誤。',
  'auth/user-not-found': 'email 或密碼錯誤。',
  'auth/invalid-email': 'email 格式不正確。',
  'auth/missing-email': '請輸入 email。',
  'auth/missing-password': '請輸入密碼。',
  'auth/user-disabled': '此帳號已被停用，請聯絡平台管理員。',
  'auth/too-many-requests': '嘗試次數過多，帳號暫時鎖定；請稍後再試，或用「忘記密碼」重設。',
  'auth/network-request-failed': '網路請求失敗，請檢查連線後重試。',
  'auth/operation-not-allowed': 'email／密碼登入尚未在 Firebase 啟用（Authentication → Sign-in method → Email/Password）。',
  'auth/unauthorized-domain': '此網域未列入 Firebase 授權清單（Authentication → Settings → Authorized domains）。',
};

export function describeAuthError(err, verb = '登入') {
  const code = err?.code || '';
  if (AUTH_ERROR_TEXT[code]) return AUTH_ERROR_TEXT[code];
  return `${verb}失敗：${code || err?.message || err}`;
}

export const PASSWORD_RESET_NOTICE =
  '若此 email 有帳號，重設密碼信已寄出；請到信箱（含垃圾郵件）點擊連結設定新密碼後回來登入。';
export const VERIFICATION_NOTICE =
  '驗證信已寄出；請到信箱點擊連結，完成後按「我已驗證」。';

let stylesInjected = false;
export function injectAuthStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .gbp-login { display: flex; flex-direction: column; gap: 10px; text-align: left;
      font-family: 'Noto Sans TC', 'Inter', system-ui, sans-serif; }
    .gbp-login label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569; font-weight: 600; }
    .gbp-login input { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; font-size: 14px;
      font-weight: 400; color: #0f172a; background: #fff; font-family: inherit; }
    .gbp-login input:focus { outline: 2px solid #c7d2fe; border-color: #4338ca; }
    .gbp-login-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .gbp-login-submit { border: 0; cursor: pointer; border-radius: 9999px; padding: 8px 18px; font-size: 13px;
      font-weight: 600; background: #4338ca; color: #fff; font-family: inherit; }
    .gbp-login-submit:hover { background: #3730a3; }
    .gbp-login-submit:disabled { opacity: .6; cursor: default; }
    .gbp-login-link { border: 0; background: none; cursor: pointer; color: #64748b; font-size: 12px; padding: 0;
      text-decoration: underline; font-family: inherit; }
    .gbp-login-link:hover { color: #0f172a; }
    .gbp-login-link:disabled { opacity: .6; cursor: default; }
    .gbp-login-hint { color: #94a3b8; font-size: 12px; }
    .gbp-login-err { color: #b91c1c; font-size: 12px; line-height: 1.5; margin: 0; }
    .gbp-login-notice { color: #047857; font-size: 12px; line-height: 1.5; margin: 0; }
    .gbp-verify { display: flex; flex-direction: column; gap: 6px; font-size: 12px; line-height: 1.5; color: #92400e;
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px; text-align: left;
      font-family: 'Noto Sans TC', 'Inter', system-ui, sans-serif; }
    .gbp-verify-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .gbp-verify-btn { border: 1px solid #f59e0b; background: #fff; color: #92400e; border-radius: 9999px;
      padding: 3px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .gbp-verify-btn:disabled { opacity: .6; cursor: default; }
    .gbp-verify-msg { margin: 0; color: #475569; }
  `;
  document.head.appendChild(style);
}

// 登入表單：email／密碼／登入／錯誤與提示。登入成功後不需回呼——呼叫端的 onAuthStateChanged 會接手。
// allowReset：是否提供「忘記密碼」寄重設信。密碼統一由管理員控管（做法 A），學員端一律 false
//（顯示「請聯絡平台管理員」）；只有管理頁登入表單開 true 讓管理員自助。
export function createLoginForm(auth, { allowReset = false } = {}) {
  injectAuthStyles();
  const form = document.createElement('form');
  form.className = 'gbp-login';
  form.noValidate = true;
  form.innerHTML = `
    <label>email<input name="email" type="email" autocomplete="username" placeholder="you@example.com" required></label>
    <label>密碼<input name="password" type="password" autocomplete="current-password" required></label>
    <div class="gbp-login-row">
      <button type="submit" class="gbp-login-submit">登入</button>
      ${allowReset
        ? '<button type="button" class="gbp-login-link" data-action="forgot">忘記密碼</button>'
        : '<span class="gbp-login-hint">忘記密碼請聯絡平台管理員</span>'}
    </div>
    <p class="gbp-login-err" hidden></p>
    <p class="gbp-login-notice" hidden></p>`;
  const emailEl = form.elements.namedItem('email');
  const pwEl = form.elements.namedItem('password');
  const submitEl = form.querySelector('.gbp-login-submit');
  const forgotEl = form.querySelector('[data-action="forgot"]');
  const errEl = form.querySelector('.gbp-login-err');
  const noticeEl = form.querySelector('.gbp-login-notice');

  const setBusy = (b) => {
    submitEl.disabled = b;
    if (forgotEl) forgotEl.disabled = b;
    submitEl.textContent = b ? '登入中…' : '登入';
  };
  const show = (el, text) => { el.textContent = text; el.hidden = !text; };
  const clear = () => { show(errEl, ''); show(noticeEl, ''); };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clear();
    const email = emailEl.value.trim();
    const password = pwEl.value;
    if (!email || !password) { show(errEl, '請輸入 email 與密碼。'); return; }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      pwEl.value = '';
    } catch (e) {
      show(errEl, describeAuthError(e, '登入'));
    } finally {
      setBusy(false);
    }
  });

  forgotEl?.addEventListener('click', async () => {
    clear();
    const email = emailEl.value.trim();
    if (!email) { show(errEl, '請先輸入 email，再按「忘記密碼」。'); emailEl.focus(); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      show(noticeEl, PASSWORD_RESET_NOTICE);
    } catch (e) {
      // 防帳號枚舉：不存在的 email 與存在者顯示同一句
      if (e?.code === 'auth/user-not-found') show(noticeEl, PASSWORD_RESET_NOTICE);
      else show(errEl, describeAuthError(e, '寄送重設信'));
    } finally {
      setBusy(false);
    }
  });

  return form;
}

// email 未驗證提示區塊（登入後 user.emailVerified === false 時掛上）。
// onRechecked(true) 讓呼叫端在驗證完成後重繪。
export function createVerifyBlock(auth, { onRechecked } = {}) {
  injectAuthStyles();
  const box = document.createElement('div');
  box.className = 'gbp-verify';
  box.innerHTML = `
    <span>email 尚未驗證——AI 功能、第四堂邀請與管理權限需先完成驗證。</span>
    <div class="gbp-verify-row">
      <button type="button" class="gbp-verify-btn" data-action="send">寄送驗證信</button>
      <button type="button" class="gbp-verify-btn" data-action="recheck">我已驗證</button>
    </div>
    <p class="gbp-verify-msg" hidden></p>`;
  const msg = box.querySelector('.gbp-verify-msg');
  const btns = [...box.querySelectorAll('button')];
  const setBusy = (b) => btns.forEach((x) => { x.disabled = b; });
  const show = (text) => { msg.textContent = text; msg.hidden = !text; };

  box.querySelector('[data-action="send"]').onclick = async () => {
    show('');
    setBusy(true);
    try {
      if (!auth.currentUser) throw new Error('尚未登入');
      await sendEmailVerification(auth.currentUser);
      show(VERIFICATION_NOTICE);
    } catch (e) {
      show(describeAuthError(e, '寄送驗證信'));
    } finally {
      setBusy(false);
    }
  };
  box.querySelector('[data-action="recheck"]').onclick = async () => {
    show('');
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) { show('尚未登入。'); return; }
      await u.reload();
      await u.getIdToken(true); // 讓後續呼叫帶到 email_verified 更新後的 token
      if (u.emailVerified) { show('email 已驗證。'); onRechecked?.(true); }
      else show('仍未驗證——請先到信箱點擊驗證連結，再按一次。');
    } catch (e) {
      show(describeAuthError(e, '重新檢查'));
    } finally {
      setBusy(false);
    }
  };
  return box;
}

// js/sso-callback.js —— Wiwi Hub SSO 回呼頁：用 sso_token 向後端換 Firebase custom token 登入。
// 成功路徑零過場——不渲染任何可見 UI，直接 location.replace('/') 回首頁；失敗才顯示 #view-error 錯誤卡。
// Firebase CDN 版本須與 js/portal-auth.js 一致（config-sync.test 會驗）；
// firebaseConfig／AI_BASE_URL／describeAuthError 皆沿用既有共用模組，不另存複本。
// 安全：不 console.log token 或後端回應內容，只 console.warn 錯誤碼／狀態，供排錯用。

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { AI_BASE_URL } from './platform-config.js';
import { describeAuthError } from './auth-ui.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const errorSection = document.getElementById('view-error');
const errorMessageEl = document.getElementById('error-message');

const MSG_MISSING_TOKEN = '缺少 SSO 憑證，請回 Wiwi Hub 重新點選「成長藍圖」卡片';
const MSG_401 = 'SSO 登入失敗：憑證已過期或此 email 尚無成長藍圖平台帳號（帳號由管理員配發）';
const MSG_404 = 'SSO 登入尚未啟用，請聯絡平台管理員';
const MSG_429 = '請求過於頻繁，請稍後再試';
const MSG_GENERIC = 'SSO 登入失敗，請稍後再試';

function showError(text) {
  errorMessageEl.textContent = text;
  errorSection.style.display = '';
}

async function exchangeAndSignIn(ssoToken) {
  let res;
  try {
    res = await fetch(`${AI_BASE_URL}/api/auth/sso/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sso_token: ssoToken }),
      credentials: 'omit',
    });
  } catch (e) {
    console.warn('sso-callback: exchange fetch 網路錯誤');
    showError(MSG_GENERIC);
    return;
  }

  if (res.status === 401) {
    console.warn('sso-callback: exchange 401');
    showError(MSG_401);
    return;
  }
  if (res.status === 404) {
    console.warn('sso-callback: exchange 404');
    showError(MSG_404);
    return;
  }
  if (res.status === 429) {
    console.warn('sso-callback: exchange 429');
    showError(MSG_429);
    return;
  }
  if (res.status !== 200) {
    console.warn(`sso-callback: exchange HTTP ${res.status}`);
    showError(MSG_GENERIC);
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    console.warn('sso-callback: exchange 回應解析失敗');
    showError(MSG_GENERIC);
    return;
  }

  const customToken = data && data.customToken;
  if (!customToken) {
    console.warn('sso-callback: exchange 回應缺少 customToken');
    showError(MSG_GENERIC);
    return;
  }

  try {
    await signInWithCustomToken(auth, customToken);
  } catch (e) {
    console.warn('sso-callback: signInWithCustomToken ' + (e && e.code ? e.code : 'unknown'));
    showError(describeAuthError(e, '登入'));
    return;
  }

  location.replace('/');
}

async function run() {
  const ssoToken = new URLSearchParams(location.search).get('sso_token');
  // 立刻把 token 從網址列與歷史移除，避免殘留在網址列／瀏覽紀錄
  history.replaceState(null, '', location.pathname);

  if (!ssoToken) {
    showError(MSG_MISSING_TOKEN);
    return;
  }

  await exchangeAndSignIn(ssoToken);
}

run().catch((e) => {
  console.warn('sso-callback: 未預期錯誤 ' + (e && e.code ? e.code : ''));
  showError(MSG_GENERIC);
});

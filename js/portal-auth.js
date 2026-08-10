// Portal 全站登入膠囊 —— 在入口站登入一次，四個單元同源共享 Firebase session。
// config 正本說明見 js/firebase-config.js；CDN URL 的版本字串必須與該檔
// FIREBASE_SDK_VERSION 一致（ESM import 需字面 URL，config-sync.test 會驗）。

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── UI（自帶樣式，不動 portal.css）──────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .gbp-auth { position: fixed; top: 16px; right: 16px; z-index: 60; display: flex; align-items: center; gap: 8px;
    font-family: 'Noto Sans TC', 'Inter', system-ui, sans-serif; }
  .gbp-auth-pill { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0;
    border-radius: 9999px; padding: 4px 12px 4px 4px; box-shadow: 0 1px 3px rgba(15,23,42,.08); font-size: 13px; }
  .gbp-auth-pill img, .gbp-auth-fallback { width: 28px; height: 28px; border-radius: 9999px; }
  .gbp-auth-fallback { display: flex; align-items: center; justify-content: center; background: #4338ca;
    color: #fff; font-weight: 700; font-size: 12px; }
  .gbp-auth-status { color: #059669; font-weight: 600; white-space: nowrap; }
  .gbp-auth-name { color: #475569; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gbp-auth-btn { border: 0; cursor: pointer; border-radius: 9999px; padding: 8px 16px; font-size: 13px;
    font-weight: 600; background: #4338ca; color: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.15); }
  .gbp-auth-btn:hover { background: #3730a3; }
  .gbp-auth-link { border: 0; background: none; cursor: pointer; color: #94a3b8; font-size: 12px; padding: 0; }
  .gbp-auth-link:hover { color: #475569; }
  .gbp-auth-err { position: fixed; top: 64px; right: 16px; z-index: 60; max-width: 300px; background: #fef2f2;
    border: 1px solid #fecaca; color: #b91c1c; font-size: 12px; line-height: 1.5; border-radius: 10px; padding: 8px 12px; }
`;
document.head.appendChild(style);

const root = document.createElement('div');
root.className = 'gbp-auth';
document.body.appendChild(root);

let errBox = null;
function showError(message) {
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.className = 'gbp-auth-err';
    document.body.appendChild(errBox);
  }
  errBox.textContent = message;
  clearTimeout(errBox._t);
  errBox._t = setTimeout(() => { errBox?.remove(); errBox = null; }, 8000);
}

function render(user) {
  root.replaceChildren();
  if (!user) {
    const btn = document.createElement('button');
    btn.className = 'gbp-auth-btn';
    btn.type = 'button';
    btn.textContent = '使用 Google 登入';
    btn.onclick = async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        const code = e?.code || '';
        showError(
          code === 'auth/popup-blocked' ? '瀏覽器擋下登入彈窗，請允許本站的彈出式視窗。'
          : code === 'auth/popup-closed-by-user' ? '登入彈窗在完成前被關閉，請再試一次。'
          : `登入失敗：${code || e?.message || e}`
        );
      }
    };
    root.appendChild(btn);
    return;
  }
  const pill = document.createElement('div');
  pill.className = 'gbp-auth-pill';
  if (user.photoURL) {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    pill.appendChild(img);
  } else {
    const fb = document.createElement('span');
    fb.className = 'gbp-auth-fallback';
    fb.textContent = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();
    pill.appendChild(fb);
  }
  const status = document.createElement('span');
  status.className = 'gbp-auth-status';
  status.textContent = '✓ 已登入';
  status.title = '四個單元共用此登入（同網域共享 session）';
  const name = document.createElement('span');
  name.className = 'gbp-auth-name';
  name.textContent = user.displayName || user.email || '';
  const out = document.createElement('button');
  out.className = 'gbp-auth-link';
  out.type = 'button';
  out.textContent = '登出';
  out.onclick = () => signOut(auth);
  pill.append(status, name, out);
  root.appendChild(pill);
}

onAuthStateChanged(auth, render);

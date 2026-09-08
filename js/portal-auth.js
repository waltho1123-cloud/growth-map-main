// Portal 全站登入膠囊 —— 在入口站登入一次，四個單元同源共享 Firebase session。
// 登入方式：email／密碼（2026-09-08 起，取代 Google OAuth）；表單與錯誤翻譯在 js/auth-ui.js。
// config 正本說明見 js/firebase-config.js；CDN URL 的版本字串必須與該檔
// FIREBASE_SDK_VERSION 一致（ESM import 需字面 URL，config-sync.test 會驗）。

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { createLoginForm, createVerifyBlock } from './auth-ui.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 平台管理員判定（與 firestore.rules 的 isPlatformAdmin 同源，不另存名單）：
// 能讀 platform/meta（文件存不存在都算）＝管理員；permission-denied＝不是。
// 每次登入狀態變更探測一次；任何錯誤都保守視為非管理員（只影響要不要顯示連結）。
async function isPlatformAdmin(user) {
  if (!user?.emailVerified) return false;
  try {
    await getDoc(doc(db, 'platform', 'meta'));
    return true;
  } catch {
    return false;
  }
}

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
  .gbp-auth-name { color: #475569; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gbp-auth-btn { border: 0; cursor: pointer; border-radius: 9999px; padding: 8px 16px; font-size: 13px;
    font-weight: 600; background: #4338ca; color: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.15); font-family: inherit; }
  .gbp-auth-btn:hover { background: #3730a3; }
  .gbp-auth-link { border: 0; background: none; cursor: pointer; color: #94a3b8; font-size: 12px; padding: 0; font-family: inherit; }
  .gbp-auth-link:hover { color: #475569; }
  .gbp-auth-admin { color: #4338ca; font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }
  .gbp-auth-admin:hover { text-decoration: underline; }
  .gbp-auth-warn { border: 0; background: none; cursor: pointer; color: #b45309; font-size: 12px; padding: 0;
    text-decoration: underline; white-space: nowrap; font-family: inherit; }
  .gbp-auth-panel { position: fixed; top: 60px; right: 16px; z-index: 60; width: 288px; background: #fff;
    border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 8px 24px rgba(15,23,42,.12);
    font-family: 'Noto Sans TC', 'Inter', system-ui, sans-serif; }
  .gbp-auth-panel h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0f172a; }
`;
document.head.appendChild(style);

const root = document.createElement('div');
root.className = 'gbp-auth';
document.body.appendChild(root);

let panel = null;
function closePanel() {
  panel?.remove();
  panel = null;
}
function openPanel(title, content) {
  closePanel();
  panel = document.createElement('div');
  panel.className = 'gbp-auth-panel';
  const h = document.createElement('h3');
  h.textContent = title;
  panel.append(h, content);
  document.body.appendChild(panel);
  panel.querySelector('input')?.focus();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
document.addEventListener('click', (e) => {
  if (panel && !panel.contains(e.target) && !root.contains(e.target)) closePanel();
});

function render(user) {
  root.replaceChildren();
  closePanel();
  if (!user) {
    const btn = document.createElement('button');
    btn.className = 'gbp-auth-btn';
    btn.type = 'button';
    btn.textContent = '登入';
    btn.onclick = () => {
      if (panel) closePanel();
      else openPanel('登入成長藍圖平台', createLoginForm(auth));
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
  pill.append(status, name);
  if (!user.emailVerified) {
    // email／密碼帳號未驗證：AI、第四堂邀請、管理權限都不開放——在膠囊上提醒並提供動作
    const warn = document.createElement('button');
    warn.className = 'gbp-auth-warn';
    warn.type = 'button';
    warn.textContent = '未驗證 email';
    warn.title = 'AI 功能、第四堂邀請與管理權限需先驗證 email';
    warn.onclick = () => {
      if (panel) closePanel();
      else openPanel('驗證 email', createVerifyBlock(auth, { onRechecked: () => render(auth.currentUser) }));
    };
    pill.appendChild(warn);
  }
  pill.appendChild(out);
  root.appendChild(pill);

  // 管理員：膠囊多一個「帳號管理」連結（探測完成後才插入；登入狀態若已改變則放棄）
  isPlatformAdmin(user).then((ok) => {
    if (!ok || auth.currentUser?.uid !== user.uid || !pill.isConnected) return;
    const admin = document.createElement('a');
    admin.className = 'gbp-auth-admin';
    admin.href = '/pages/admin.html';
    admin.textContent = '帳號管理';
    admin.title = '平台帳號管理（僅管理員可見）';
    pill.insertBefore(admin, out);
  });
}

onAuthStateChanged(auth, render);

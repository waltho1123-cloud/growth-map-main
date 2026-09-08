// 平台帳號管理頁（pages/admin.html）——僅平台管理員可用（firestore.rules isPlatformAdmin）。
// 功能：帳號目錄（platformUsers 即時清單）、平台封鎖/解封、增補管理員（platform/meta）。
// 登入方式：email／密碼（2026-09-08 起）；表單與錯誤翻譯在 js/auth-ui.js。
// 帳號與密碼（做法 A）：本頁透過後端 /api/admin/*（服務帳號代辦 Firebase Auth 管理 API）
// 建帳號、設密碼、停用／啟用、開關登入方式——學員零 Firebase 接觸，密碼統一由管理員控管。
// CDN 版本須與 js/firebase-config.js 的 FIREBASE_SDK_VERSION 一致（測試會驗）。

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, updateDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { createLoginForm } from './auth-ui.js';
import { AI_BASE_URL } from './platform-config.js';

const ROOT_ADMIN = 'waltho1123@gmail.com'; // 與 firestore.rules 的 root 常數一致

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const fmt = (ms) => (ms ? new Date(ms).toLocaleString('zh-TW', { hour12: false }) : '—');

let me = null;
let users = [];
let adminEmails = [];
let aiAllowlist = { emails: [], domains: [] };
let unsubUsers = null;
let unsubMeta = null;
let unsubAi = null;

function show(sectionId) {
  for (const id of ['view-login', 'view-denied', 'view-admin']) {
    $(id).style.display = id === sectionId ? '' : 'none';
  }
}

function renderUsers() {
  const tbody = $('user-rows');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">尚無帳號記錄（帳號目錄從本次部署後的登入開始累積）。</td></tr>';
    return;
  }
  tbody.innerHTML = users.map((u) => `
    <tr class="${u.blocked ? 'row-blocked' : ''}">
      <td class="cell-id">
        ${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : '<span class="avatar-fallback">' + esc((u.displayName || u.email || '?')[0].toUpperCase()) + '</span>'}
        <span>
          <b>${esc(u.displayName || '（無名稱）')}</b><br>
          <span class="muted">${esc(u.email)}</span>
          ${u.emailVerified === false ? '<span class="badge badge-warn" title="未驗證前不能用 AI、接受邀請或當管理員">email 未驗證</span>' : ''}
        </span>
      </td>
      <td>${fmt(u.firstSeenAt)}</td>
      <td>${fmt(u.lastSeenAt)}</td>
      <td class="muted">${esc(u.lastPath || '—')}</td>
      <td>${u.blocked ? '<span class="badge badge-blocked">已封鎖</span>' : '<span class="badge badge-ok">正常</span>'}</td>
      <td>
        ${u.id === me?.uid
          ? '<span class="muted">（自己）</span>'
          : `<button class="btn-small ${u.blocked ? '' : 'btn-danger'}" data-uid="${esc(u.id)}" data-blocked="${u.blocked ? '1' : ''}">${u.blocked ? '解除封鎖' : '封鎖'}</button>`}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('button[data-uid]').forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.uid;
      const nowBlocked = !btn.dataset.blocked;
      const target = users.find((x) => x.id === uid);
      const verb = nowBlocked ? '封鎖' : '解除封鎖';
      if (!window.confirm(`確定${verb}「${target?.email}」？封鎖後該帳號全平台禁止寫入（可讀）；要完全停用請另至 Firebase Console。`)) return;
      try {
        await updateDoc(doc(db, 'platformUsers', uid), {
          blocked: nowBlocked,
          blockedAt: nowBlocked ? Date.now() : null,
          blockedBy: nowBlocked ? (me.email || me.uid) : null,
        });
      } catch (e) {
        window.alert(`操作失敗：${e.message}`);
      }
    };
  });
}

function renderAdmins() {
  $('admin-list').innerHTML =
    `<li><b>${esc(ROOT_ADMIN)}</b> <span class="muted">（root，寫死於安全規則）</span></li>`
    + adminEmails.map((e) => `
      <li>${esc(e)} <button class="btn-small" data-remove="${esc(e)}">移除</button></li>`).join('');
  $('admin-list').querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.onclick = async () => {
      const next = adminEmails.filter((x) => x !== btn.dataset.remove);
      await setDoc(doc(db, 'platform', 'meta'), { adminEmails: next });
    };
  });
}

function renderAiAllowlist() {
  const saveAi = (patch) => setDoc(doc(db, 'platform', 'aiAllowlist'), { ...aiAllowlist, ...patch })
    .catch((e) => window.alert(`儲存失敗：${e.message}`));
  $('ai-email-list').innerHTML = aiAllowlist.emails.length
    ? aiAllowlist.emails.map((e) => `<li>${esc(e)} <button class="btn-small" data-ai-email="${esc(e)}">移除</button></li>`).join('')
    : '<li class="muted">（此處尚無 email——僅環境變數保底名單生效）</li>';
  $('ai-domain-list').innerHTML = aiAllowlist.domains.length
    ? aiAllowlist.domains.map((d) => `<li>@${esc(d)}（整網域） <button class="btn-small" data-ai-domain="${esc(d)}">移除</button></li>`).join('')
    : '';
  $('ai-email-list').querySelectorAll('button[data-ai-email]').forEach((b) => {
    b.onclick = () => saveAi({ emails: aiAllowlist.emails.filter((x) => x !== b.dataset.aiEmail) });
  });
  $('ai-domain-list').querySelectorAll('button[data-ai-domain]').forEach((b) => {
    b.onclick = () => saveAi({ domains: aiAllowlist.domains.filter((x) => x !== b.dataset.aiDomain) });
  });
  $('btn-add-ai-email').onclick = () => {
    const email = $('new-ai-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    saveAi({ emails: [...new Set([...aiAllowlist.emails, email])] });
    $('new-ai-email').value = '';
  };
  $('btn-add-ai-domain').onclick = () => {
    const domain = $('new-ai-domain').value.trim().toLowerCase().replace(/^@/, '');
    if (!domain || !domain.includes('.')) return;
    saveAi({ domains: [...new Set([...aiAllowlist.domains, domain])] });
    $('new-ai-domain').value = '';
  };
}

let adminApiBound = false;
function startAdminView() {
  show('view-admin');
  $('me-line').textContent = `管理員：${me.displayName || ''}（${me.email}）`;
  if (!adminApiBound) { bindAdminApiUi(); adminApiBound = true; }
  loadAuthConfig();
  loadAccounts();

  unsubUsers = onSnapshot(collection(db, 'platformUsers'), (snap) => {
    users = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    $('user-count').textContent = `${users.length} 個帳號`;
    renderUsers();
  }, () => {
    // 讀整個目錄被拒＝非管理員
    unsubUsers?.(); unsubMeta?.(); unsubAi?.();
    show('view-denied');
  });

  unsubMeta = onSnapshot(doc(db, 'platform', 'meta'), (snap) => {
    adminEmails = (snap.exists() ? snap.data().adminEmails : []) || [];
    renderAdmins();
  }, () => { adminEmails = []; renderAdmins(); });

  unsubAi = onSnapshot(doc(db, 'platform', 'aiAllowlist'), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    aiAllowlist = { emails: data.emails || [], domains: data.domains || [] };
    renderAiAllowlist();
  }, () => { aiAllowlist = { emails: [], domains: [] }; renderAiAllowlist(); });

  $('btn-add-admin').onclick = async () => {
    const email = $('new-admin-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    try {
      await setDoc(doc(db, 'platform', 'meta'), { adminEmails: [...new Set([...adminEmails, email])] });
      $('new-admin-email').value = '';
    } catch (e) {
      window.alert(`新增失敗：${e.message}`);
    }
  };
}

$('login-form').replaceChildren(createLoginForm(auth, { allowReset: true }));

// ── 後端管理 API（/api/admin/*）────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const token = await me.getIdToken();
  const res = await fetch(`${AI_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.code = data?.error?.code || '';
    err.status = res.status;
    throw err;
  }
  return data;
}

const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function genPassword(len = 12) {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => PW_ALPHABET[n % PW_ALPHABET.length]).join('');
}

const PROVIDER_LABEL = { password: 'email／密碼', 'google.com': 'Google' };
let accounts = [];

function renderAccounts() {
  const tbody = $('account-rows');
  $('account-count').textContent = `${accounts.length} 個帳號`;
  if (!accounts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">尚無帳號。</td></tr>';
    return;
  }
  tbody.innerHTML = accounts.map((a) => `
    <tr class="${a.disabled ? 'row-blocked' : ''}" data-row="${esc(a.uid)}">
      <td class="cell-id">
        <span>
          <b>${esc(a.displayName || '（無名稱）')}</b><br>
          <span class="muted">${esc(a.email)}</span>
        </span>
      </td>
      <td>${esc(a.providers.map((p) => PROVIDER_LABEL[p] || p).join('＋') || '—')}</td>
      <td>${a.emailVerified ? '<span class="badge badge-ok">已驗證</span>' : '<span class="badge badge-warn" style="margin-left:0">未驗證</span>'}</td>
      <td>${a.disabled ? '<span class="badge badge-blocked">已停用</span>' : '<span class="badge badge-ok">啟用</span>'}</td>
      <td>${fmt(a.lastLoginAt)}</td>
      <td class="actions">
        <button class="btn-small" data-pw="${esc(a.uid)}">設定密碼</button>
        ${a.uid === me?.uid
          ? '<span class="muted">（自己）</span>'
          : `<button class="btn-small ${a.disabled ? '' : 'btn-danger'}" data-toggle="${esc(a.uid)}" data-disabled="${a.disabled ? '1' : ''}">${a.disabled ? '啟用' : '停用'}</button>
             <button class="btn-small btn-danger" data-del="${esc(a.uid)}">刪除</button>`}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('button[data-pw]').forEach((btn) => {
    btn.onclick = () => openPasswordEditor(btn.dataset.pw);
  });
  tbody.querySelectorAll('button[data-del]').forEach((btn) => {
    btn.onclick = () => openDeleteEditor(btn.dataset.del);
  });
  tbody.querySelectorAll('button[data-toggle]').forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.dataset.toggle;
      const target = accounts.find((x) => x.uid === uid);
      const nowDisabled = !btn.dataset.disabled;
      const verb = nowDisabled ? '停用' : '啟用';
      if (!window.confirm(`確定${verb}「${target?.email}」？停用後該帳號無法登入（資料保留）。`)) return;
      try {
        await api(`/api/admin/accounts/${uid}/disabled`, { method: 'POST', body: { disabled: nowDisabled } });
        await loadAccounts();
      } catch (e) {
        $('accounts-err').textContent = `操作失敗：${e.message}`;
      }
    };
  });
}

// 刪除帳號：內嵌確認列——重打 email 才能送出；工作簿資料預設保留（勾選才連同刪除，不可復原）
function openDeleteEditor(uid) {
  document.querySelectorAll('tr.pw-row').forEach((r) => r.remove());
  const row = document.querySelector(`tr[data-row="${CSS.escape(uid)}"]`);
  const target = accounts.find((x) => x.uid === uid);
  if (!row || !target) return;
  const editor = document.createElement('tr');
  editor.className = 'pw-row';
  editor.innerHTML = `
    <td colspan="6">
      <div class="pw-editor del-editor">
        <span>刪除 <b>${esc(target.email)}</b>：帳號將無法登入且不可復原。輸入該 email 確認：</span>
        <input type="email" class="del-confirm" placeholder="${esc(target.email)}" autocomplete="off">
        <label class="del-purge"><input type="checkbox" class="del-purge-box"> 同時刪除此帳號的工作簿資料（單元一～三雲端資料，不可復原）</label>
        <button type="button" class="btn-small btn-danger del-save">確認刪除</button>
        <button type="button" class="btn-small del-cancel">取消</button>
        <span class="pw-msg muted"></span>
      </div>
    </td>`;
  row.after(editor);
  const input = editor.querySelector('.del-confirm');
  const purgeBox = editor.querySelector('.del-purge-box');
  const msg = editor.querySelector('.pw-msg');
  editor.querySelector('.del-cancel').onclick = () => editor.remove();
  editor.querySelector('.del-save').onclick = async () => {
    const confirmEmail = input.value.trim().toLowerCase();
    if (confirmEmail !== target.email.toLowerCase()) { msg.textContent = 'email 不符，未刪除'; return; }
    const purgeData = purgeBox.checked;
    if (purgeData && !window.confirm(`確定連同 ${target.email} 的工作簿資料一起刪除？此動作不可復原。`)) return;
    msg.textContent = '刪除中…';
    try {
      const r = await api(`/api/admin/accounts/${uid}/delete`, { method: 'POST', body: { confirmEmail, purgeData } });
      const purge = r.purge || {};
      $('create-msg').textContent = `已刪除 ${target.email}；工作簿資料：${purgeData ? `已刪除 ${purge.userDocs || 0} 份文件` : '保留'}`
        + (purge.error ? `（Firestore 清理未完成：${purge.error}）` : '');
      await loadAccounts();
    } catch (e) {
      msg.textContent = `失敗：${e.message}`;
    }
  };
  input.focus();
}

function openPasswordEditor(uid) {
  document.querySelectorAll('tr.pw-row').forEach((r) => r.remove());
  const row = document.querySelector(`tr[data-row="${CSS.escape(uid)}"]`);
  const target = accounts.find((x) => x.uid === uid);
  if (!row || !target) return;
  const editor = document.createElement('tr');
  editor.className = 'pw-row';
  editor.innerHTML = `
    <td colspan="6">
      <div class="pw-editor">
        <span>為 <b>${esc(target.email)}</b> 設定新密碼：</span>
        <input type="text" class="pw-input" placeholder="至少 8 碼" autocomplete="off">
        <button type="button" class="btn-small pw-gen">產生</button>
        <button type="button" class="btn-small btn-primary pw-save">儲存</button>
        <button type="button" class="btn-small pw-cancel">取消</button>
        <span class="pw-msg muted"></span>
      </div>
    </td>`;
  row.after(editor);
  const input = editor.querySelector('.pw-input');
  const msg = editor.querySelector('.pw-msg');
  editor.querySelector('.pw-gen').onclick = () => { input.value = genPassword(); };
  editor.querySelector('.pw-cancel').onclick = () => editor.remove();
  editor.querySelector('.pw-save').onclick = async () => {
    const pw = input.value;
    if (pw.length < 8) { msg.textContent = '密碼至少 8 碼'; return; }
    msg.textContent = '儲存中…';
    try {
      await api(`/api/admin/accounts/${uid}/password`, { method: 'POST', body: { password: pw } });
      msg.textContent = `已更新，請把密碼「${pw}」交給對方（此頁不會再顯示）。`;
      await loadAccounts();
      // loadAccounts 會重繪表格，把訊息放到卡片層級
      $('accounts-err').textContent = '';
      $('create-msg').textContent = `已設定 ${target.email} 的密碼：${pw}（請立即交給對方；重新整理後不再顯示）`;
    } catch (e) {
      msg.textContent = `失敗：${e.message}`;
    }
  };
  input.focus();
}

async function loadAccounts() {
  try {
    const data = await api('/api/admin/accounts');
    accounts = (data.accounts || []).slice().sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
    $('accounts-err').textContent = '';
    renderAccounts();
  } catch (e) {
    accounts = [];
    $('account-rows').innerHTML = `<tr><td colspan="6" class="muted">${esc(describeAdminApiError(e))}</td></tr>`;
    $('account-count').textContent = '';
  }
}

function describeAdminApiError(e) {
  if (e.code === 'IDO_ADMIN_NOT_CONFIGURED') return `後端尚未設定服務帳號：${e.message}`;
  if (e.code === 'IDO_ADMIN_ONLY') return `後端拒絕：${e.message}`;
  if (e.message === 'Failed to fetch') return '無法連線後端（CORS 或網路）——本機測試需後端 ALLOWED_ORIGINS 含此 origin';
  return `讀取失敗：${e.message}`;
}

async function loadAuthConfig() {
  const el = $('auth-config-status');
  try {
    const cfg = await api('/api/admin/auth-config');
    el.innerHTML = `Email／密碼登入：<b>${cfg.emailPasswordEnabled ? '已啟用' : '停用'}</b>　自助註冊：<b>${cfg.signUpDisabled ? '已關閉' : '開放中'}</b>`
      + `<br><span class="muted">授權網域：${esc(cfg.authorizedDomains.join('、'))}</span>`;
    $('btn-auth-config').style.display = cfg.emailPasswordEnabled && cfg.signUpDisabled ? 'none' : '';
    $('auth-config-err').textContent = '';
  } catch (e) {
    el.textContent = describeAdminApiError(e);
    $('btn-auth-config').style.display = 'none';
  }
}

function bindAdminApiUi() {
  $('btn-gen-password').onclick = () => { $('new-acct-password').value = genPassword(); };
  $('create-account').onsubmit = async (ev) => {
    ev.preventDefault();
    const email = $('new-acct-email').value.trim().toLowerCase();
    const displayName = $('new-acct-name').value.trim();
    const password = $('new-acct-password').value;
    $('create-msg').textContent = '建立中…';
    try {
      await api('/api/admin/accounts', { method: 'POST', body: { email, displayName, password } });
      $('create-msg').textContent = `已建立 ${email}，初始密碼：${password}（請立即交給對方；重新整理後不再顯示）`;
      $('new-acct-email').value = '';
      $('new-acct-name').value = '';
      $('new-acct-password').value = '';
      await loadAccounts();
    } catch (e) {
      $('create-msg').textContent = `建立失敗：${e.message}`;
    }
  };
  $('btn-auth-config').onclick = async () => {
    if (!window.confirm('將啟用 Email／密碼登入並關閉自助註冊（外人無法自行建帳號）。確定？')) return;
    $('auth-config-err').textContent = '套用中…';
    try {
      await api('/api/admin/auth-config', { method: 'POST', body: { disableSignup: true } });
      await loadAuthConfig();
    } catch (e) {
      $('auth-config-err').textContent = `套用失敗：${e.message}`;
    }
  };
}
document.querySelectorAll('.btn-logout').forEach((b) => { b.onclick = () => signOut(auth); });

onAuthStateChanged(auth, (u) => {
  unsubUsers?.(); unsubMeta?.(); unsubAi?.();
  me = u;
  if (!u) {
    show('view-login');
    return;
  }
  startAdminView(); // 權限由 rules 決定——非管理員的清單訂閱會被拒，轉入無權限視圖
});

// 平台帳號管理頁（pages/admin.html）——僅平台管理員可用（firestore.rules isPlatformAdmin）。
// 功能：帳號目錄（platformUsers 即時清單）、平台封鎖/解封、增補管理員（platform/meta）。
// CDN 版本須與 js/firebase-config.js 的 FIREBASE_SDK_VERSION 一致（測試會驗）。

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, updateDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

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

function startAdminView() {
  show('view-admin');
  $('me-line').textContent = `管理員：${me.displayName || ''}（${me.email}）`;

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

$('btn-login').onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    $('login-err').textContent = `登入失敗：${e.code || e.message}`;
  }
};
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

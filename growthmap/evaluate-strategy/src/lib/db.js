// Firestore 資料層（多人共享 evalProjects）——本單元唯一的讀寫面。
// 與單元一～三的 @growthmap/cloud whole-doc 同步刻意不同：
// 多人並行編輯走「細粒度文件 + onSnapshot」，天然避開整份文件的衝突合併。

import { EVAL_PROJECTS_COLLECTION } from '@growthmap/contracts';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { getFirebase } from './cloud/firebase';
import { createProjectDoc } from '../domain/model';

async function db() {
  const { db: instance } = await getFirebase();
  if (!instance) throw new Error('Firebase 未設定（isFirebaseConfigured=false）');
  return instance;
}

const projRef = (d, pid) => doc(d, EVAL_PROJECTS_COLLECTION, pid);
const subCol = (d, pid, sub) => collection(d, EVAL_PROJECTS_COLLECTION, pid, sub);

// ── 專案清單與生命週期 ────────────────────────────────────────────────────────

// 我是成員的專案（即時）
export function subscribeMyProjects(uid, onChange, onError) {
  let unsub = null;
  let cancelled = false;
  (async () => {
    const d = await db();
    if (cancelled) return;
    const q = query(collection(d, EVAL_PROJECTS_COLLECTION), where('memberUids', 'array-contains', uid));
    unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onChange(rows);
    }, (err) => onError?.(err));
  })();
  return () => { cancelled = true; unsub?.(); };
}

// 邀請我加入的專案（即時；以登入 email 比對）
export function subscribeMyInvites(email, onChange, onError) {
  if (!email) return () => {};
  let unsub = null;
  let cancelled = false;
  (async () => {
    const d = await db();
    if (cancelled) return;
    const q = query(collection(d, EVAL_PROJECTS_COLLECTION), where('invitedEmails', 'array-contains', email));
    unsub = onSnapshot(q, (snap) => {
      onChange(snap.docs.map((x) => ({ id: x.id, ...x.data() })));
    }, (err) => onError?.(err));
  })();
  return () => { cancelled = true; unsub?.(); };
}

export async function createProject(user, name) {
  const d = await db();
  const payload = createProjectDoc({
    name,
    uid: user.uid,
    email: (user.email || '').toLowerCase(),
    displayName: user.displayName || '',
  });
  const ref = await addDoc(collection(d, EVAL_PROJECTS_COLLECTION), payload);
  return ref.id;
}

export async function deleteProject(pid) {
  // 註：子集合文件不會被父文件刪除連帶清掉；內部工具接受殘留（無讀取路徑）。
  const d = await db();
  await deleteDoc(projRef(d, pid));
}

// ── 成員與邀請 ───────────────────────────────────────────────────────────────

// 邀請成員（owner/facilitator 於 UI 觸發；email 一律小寫正規化）
export async function inviteMember(project, email, role) {
  const d = await db();
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) throw new Error('email 不可為空');
  const invitedEmails = [...new Set([...(project.invitedEmails || []), norm])];
  // inviteRoles 的 key 含「.」：不可用欄位路徑逐鍵更新，必須整張 map 覆寫
  const inviteRoles = { ...(project.inviteRoles || {}), [norm]: role || 'member' };
  await updateDoc(projRef(d, project.id), { invitedEmails, inviteRoles });
}

export async function revokeInvite(project, email) {
  const d = await db();
  const inviteRoles = { ...(project.inviteRoles || {}) };
  delete inviteRoles[email];
  await updateDoc(projRef(d, project.id), {
    invitedEmails: (project.invitedEmails || []).filter((e) => e !== email),
    inviteRoles,
  });
}

// 受邀者自助加入。交易內重讀最新成員陣列，寫入形狀須與 firestore.rules 的
// isSelfJoin() 完全對齊：memberUids 尾端附加自己、members 只多自己一鍵、
// 角色必須等於 inviteRoles[email]。
export async function joinProject(pid, user) {
  const d = await db();
  const email = (user.email || '').toLowerCase();
  await runTransaction(d, async (tx) => {
    const snap = await tx.get(projRef(d, pid));
    if (!snap.exists()) throw new Error('專案不存在');
    const data = snap.data();
    if ((data.memberUids || []).includes(user.uid)) return; // 已是成員（重複點擊）
    if (!(data.invitedEmails || []).includes(email)) throw new Error('此帳號不在受邀名單');
    const role = data.inviteRoles?.[email] || 'member';
    const inviteRoles = { ...(data.inviteRoles || {}) };
    delete inviteRoles[email];
    tx.update(projRef(d, pid), {
      memberUids: [...(data.memberUids || []), user.uid],
      members: {
        ...(data.members || {}),
        [user.uid]: { role, email, displayName: user.displayName || '' },
      },
      invitedEmails: (data.invitedEmails || []).filter((e) => e !== email),
      inviteRoles,
    });
  });
}

export async function updateMemberRole(project, uid, role) {
  const d = await db();
  const members = { ...(project.members || {}) };
  if (!members[uid]) throw new Error('成員不存在');
  members[uid] = { ...members[uid], role };
  await updateDoc(projRef(d, project.id), { members });
}

export async function removeMember(project, uid) {
  const d = await db();
  const members = { ...(project.members || {}) };
  delete members[uid];
  await updateDoc(projRef(d, project.id), {
    members,
    memberUids: (project.memberUids || []).filter((x) => x !== uid),
  });
}

// ── 專案文件與子集合的即時訂閱 ─────────────────────────────────────────────────

export function subscribeProjectDoc(pid, onChange, onError) {
  let unsub = null;
  let cancelled = false;
  (async () => {
    const d = await db();
    if (cancelled) return;
    unsub = onSnapshot(projRef(d, pid), (snap) => {
      onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (err) => onError?.(err));
  })();
  return () => { cancelled = true; unsub?.(); };
}

export function subscribeSubcollection(pid, sub, onChange, onError) {
  let unsub = null;
  let cancelled = false;
  (async () => {
    const d = await db();
    if (cancelled) return;
    unsub = onSnapshot(subCol(d, pid, sub), (snap) => {
      onChange(snap.docs.map((x) => ({ id: x.id, ...x.data() })));
    }, (err) => onError?.(err));
  })();
  return () => { cancelled = true; unsub?.(); };
}

// ── 寫入原語（targeted update；並行編輯衝突面最小化）─────────────────────────

export async function updateProject(pid, patch) {
  const d = await db();
  await updateDoc(projRef(d, pid), patch);
}

export async function addSubDoc(pid, sub, data) {
  const d = await db();
  const ref = await addDoc(subCol(d, pid, sub), data);
  return ref.id;
}

export async function setSubDoc(pid, sub, id, data, { merge = false } = {}) {
  const d = await db();
  await setDoc(doc(d, EVAL_PROJECTS_COLLECTION, pid, sub, id), data, { merge });
}

export async function updateSubDoc(pid, sub, id, patch) {
  const d = await db();
  await updateDoc(doc(d, EVAL_PROJECTS_COLLECTION, pid, sub, id), patch);
}

export async function deleteSubDoc(pid, sub, id) {
  const d = await db();
  await deleteDoc(doc(d, EVAL_PROJECTS_COLLECTION, pid, sub, id));
}

export async function getSubDocIds(pid, sub) {
  const d = await db();
  const snap = await getDocs(subCol(d, pid, sub));
  return snap.docs.map((x) => x.id);
}

export async function getSubDocs(pid, sub) {
  const d = await db();
  const snap = await getDocs(subCol(d, pid, sub));
  return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
}

// 批次寫入（承接匯入用）
export async function batchSetSubDocs(pid, sub, entries) {
  const d = await db();
  const batch = writeBatch(d);
  for (const { id, data } of entries) {
    batch.set(doc(d, EVAL_PROJECTS_COLLECTION, pid, sub, id), data);
  }
  await batch.commit();
}

// 讀單一使用者 app 文件（承接單元三／二資料用；只讀自己的）
export async function getUserAppDoc(segments) {
  const d = await db();
  const snap = await getDoc(doc(d, ...segments));
  return snap.exists() ? snap.data() : null;
}

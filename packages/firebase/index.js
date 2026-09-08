// @growthmap/firebase — 全平台共用的 Firebase 層唯一正本（Phase 2d）。
//
// 歷史：config／lazy init／auth 曾在三單元各複製一份；2026-08-09 盤點確認三份
// 語意完全相同（差異僅 TS 型別註記），純複製合一、零行為變更。
// 2026-09-08：登入方式由 Google OAuth 改為 email／密碼（signInWithEmailAndPassword）。
// 登入表單的「邏輯」（欄位狀態、送出、忘記密碼、錯誤翻譯、驗證信）由本包的
// useEmailLogin／useEmailVerification 共用；表單「樣式與版位」仍屬各單元自主
//（AuthWidget／LoginGate 留在單元內，與 2026-08-09 的 ADR 一致）。
//
// email 信任邊界（改登入方式的安全後果）：email／密碼帳號的 email 是填寫者自稱，
// 未點驗證信前不可信。凡以 email 授權的地方——firestore.rules 的 isPlatformAdmin／
// 第四堂邀請、後端 AI 白名單——一律要求 token.email_verified == true。
// Google 時代建立的帳號本來就已驗證。

import { useCallback, useEffect, useState } from 'react';

// ── config ────────────────────────────────────────────────────────────────────
// Firebase web config — these values are PUBLIC by design.
// Real security is enforced by Firestore security rules, not by hiding this.
export const firebaseConfig = {
  apiKey: 'AIzaSyANpkc1-X1-1VMiPjZLkw_2CeOhc2BVzfk',
  authDomain: 'growth-map-main.firebaseapp.com',
  projectId: 'growth-map-main',
  storageBucket: 'growth-map-main.firebasestorage.app',
  messagingSenderId: '421192696889',
  appId: '1:421192696889:web:ea0d2b14a63709207c79e8',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME';

// ── lazy init ─────────────────────────────────────────────────────────────────
let app = null;
let authInstance = null;
let dbInstance = null;
let initPromise = null;

export async function getFirebase() {
  if (!isFirebaseConfigured) return { app: null, auth: null, db: null };
  if (app) return { app, auth: authInstance, db: dbInstance };
  if (!initPromise) {
    initPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
    })();
  }
  await initPromise;
  return { app, auth: authInstance, db: dbInstance };
}

// ── auth：email／密碼 ─────────────────────────────────────────────────────────
export async function signInWithEmail(email, password) {
  const { auth } = await getFirebase();
  if (!auth) throw new Error('Firebase not configured');
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const result = await signInWithEmailAndPassword(
    auth, String(email || '').trim(), String(password || '')
  );
  return result.user;
}

// 忘記密碼／設定初始密碼：寄 Firebase 內建的重設密碼信（action handler 頁由 Firebase 代管）。
// 管理員在 Console 建好帳號後，使用者也是走這條自行設定密碼。
export async function sendPasswordReset(email) {
  const { auth } = await getFirebase();
  if (!auth) throw new Error('Firebase not configured');
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, String(email || '').trim());
}

// 驗證信：給目前登入者。email 未驗證者不能用 AI、不能接受第四堂邀請、不能當管理員。
export async function sendVerificationEmail() {
  const { auth } = await getFirebase();
  if (!auth?.currentUser) throw new Error('尚未登入');
  const { sendEmailVerification } = await import('firebase/auth');
  await sendEmailVerification(auth.currentUser);
}

export async function signOut() {
  const { auth } = await getFirebase();
  if (!auth) return;
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
}

// Firebase auth 錯誤碼 → 使用者看得懂的繁中訊息（含「該去哪裡修」的線索）。
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

// 平台帳號目錄（platformUsers/{uid}）：登入時 fire-and-forget upsert 本人 profile，
// 供 pages/admin.html 管理頁列出「誰在用平台」。失敗一律靜默——目錄寫入
// （含被平台封鎖時的規則拒絕）不得影響登入與單元功能。
async function touchPlatformProfile(user) {
  try {
    const { db } = await getFirebase();
    if (!db || !user) return;
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const ref = doc(db, 'platformUsers', user.uid);
    const base = {
      email: (user.email || '').toLowerCase(),
      emailVerified: user.emailVerified === true,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastSeenAt: Date.now(),
      lastPath: (typeof location !== 'undefined' ? location.pathname : '').slice(0, 100),
    };
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await setDoc(ref, base, { merge: true });
    } else {
      await setDoc(ref, { ...base, firstSeenAt: Date.now(), blocked: false });
    }
  } catch { /* 目錄失敗不影響登入 */ }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // token 刷新（含驗證 email 後 getIdToken(true)）時 user 物件是原地更新、參照不變，
  // 用 tick 逼所有 useAuth 訂閱者重繪，讓 user.emailVerified 的新值反映到畫面。
  const [, setTick] = useState(0);

  useEffect(() => {
    let unsub;
    let lastUid = null;
    (async () => {
      const { auth } = await getFirebase();
      if (!auth) {
        setLoading(false);
        return;
      }
      const { onIdTokenChanged } = await import('firebase/auth');
      unsub = onIdTokenChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        setTick((t) => t + 1);
        const uid = u?.uid || null;
        if (u && uid !== lastUid) touchPlatformProfile(u); // 帳號目錄：不 await、不擋 UI；每次登入一次
        lastUid = uid;
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return { user, loading };
}

// 登入表單邏輯（各單元自行決定表單長相）：
//   email/password 欄位狀態、submit（登入）、resetPassword（忘記密碼）、
//   error（紅字）、notice（綠字提示）、busy。登入成功不需自行切畫面——
//   useAuth 的 onIdTokenChanged 會接手。
export function useEmailLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = useCallback(async () => {
    const e = email.trim();
    if (!e || !password) {
      setError('請輸入 email 與密碼。');
      setNotice('');
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithEmail(e, password);
      setPassword('');
      return true;
    } catch (err) {
      setError(describeAuthError(err, '登入'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  const resetPassword = useCallback(async () => {
    const e = email.trim();
    if (!e) {
      setError('請先輸入 email，再按「忘記密碼」。');
      setNotice('');
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendPasswordReset(e);
      setNotice(PASSWORD_RESET_NOTICE);
      return true;
    } catch (err) {
      // 防帳號枚舉：不存在的 email 與存在者顯示同一句（Firebase 開枚舉保護時本就不回這個碼）
      if (err?.code === 'auth/user-not-found') {
        setNotice(PASSWORD_RESET_NOTICE);
        return true;
      }
      setError(describeAuthError(err, '寄送重設信'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [email]);

  return { email, setEmail, password, setPassword, busy, error, notice, submit, resetPassword };
}

// email 驗證流程（登入後 user.emailVerified === false 時顯示）：
//   send（寄驗證信）、recheck（使用者點完連結後：reload + 強制刷新 token，
//   讓後續 AI 呼叫帶到 email_verified=true 的新 token）。
export function useEmailVerification() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const send = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      await sendVerificationEmail();
      setMessage(VERIFICATION_NOTICE);
      return true;
    } catch (err) {
      setMessage(describeAuthError(err, '寄送驗證信'));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const recheck = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const { auth } = await getFirebase();
      const u = auth?.currentUser;
      if (!u) {
        setMessage('尚未登入。');
        return false;
      }
      await u.reload();
      await u.getIdToken(true); // 觸發 onIdTokenChanged → useAuth 訂閱者重繪
      if (u.emailVerified) {
        setMessage('email 已驗證。');
        return true;
      }
      setMessage('仍未驗證——請先到信箱點擊驗證連結，再按一次。');
      return false;
    } catch (err) {
      setMessage(describeAuthError(err, '重新檢查'));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { send, recheck, busy, message };
}

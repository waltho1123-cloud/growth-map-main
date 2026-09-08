import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export declare const firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export declare const isFirebaseConfigured: boolean;

export declare function getFirebase(): Promise<{
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
}>;

/** email／密碼登入（signInWithEmailAndPassword）。 */
export declare function signInWithEmail(email: string, password: string): Promise<User>;

/** 忘記密碼／設定初始密碼：寄 Firebase 重設密碼信。 */
export declare function sendPasswordReset(email: string): Promise<void>;

/** 寄驗證信給目前登入者（未登入時 reject）。 */
export declare function sendVerificationEmail(): Promise<void>;

export declare function signOut(): Promise<void>;

/** Firebase auth 錯誤 → 繁中訊息；verb 用於未知錯誤的前綴（預設「登入」）。 */
export declare function describeAuthError(err: unknown, verb?: string): string;

export declare const PASSWORD_RESET_NOTICE: string;
export declare const VERIFICATION_NOTICE: string;

export declare function useAuth(): { user: User | null; loading: boolean };

export interface EmailLoginState {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  busy: boolean;
  /** 登入／重設失敗的紅字；空字串＝無錯誤 */
  error: string;
  /** 成功提示（例：重設信已寄出）；空字串＝無 */
  notice: string;
  /** 登入；成功回 true（畫面切換交給 useAuth） */
  submit: () => Promise<boolean>;
  /** 用目前 email 欄位寄重設密碼信 */
  resetPassword: () => Promise<boolean>;
}
export declare function useEmailLogin(): EmailLoginState;

export interface EmailVerificationState {
  /** 寄驗證信給目前登入者 */
  send: () => Promise<boolean>;
  /** 點完驗證連結後：reload user ＋ 強制刷新 token；已驗證回 true */
  recheck: () => Promise<boolean>;
  busy: boolean;
  message: string;
}
export declare function useEmailVerification(): EmailVerificationState;

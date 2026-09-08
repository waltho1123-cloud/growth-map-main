// Firebase 層正本在 @growthmap/firebase（全平台共用）；此檔僅保持單元內 import 路徑慣例。
export {
  signInWithEmail, sendPasswordReset, sendVerificationEmail, signOut, describeAuthError,
  useAuth, useEmailLogin, useEmailVerification, PASSWORD_RESET_NOTICE, VERIFICATION_NOTICE,
} from '@growthmap/firebase';

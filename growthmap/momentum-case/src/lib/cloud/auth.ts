// Firebase 層正本在 @growthmap/firebase（三單元共用）；此檔僅保持既有 import 路徑。
export {
  signInWithEmail, sendPasswordReset, sendVerificationEmail, signOut, describeAuthError,
  useAuth, useEmailLogin, useEmailVerification, PASSWORD_RESET_NOTICE, VERIFICATION_NOTICE,
} from '@growthmap/firebase';

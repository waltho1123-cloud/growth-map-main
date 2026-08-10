// Portal 層 Firebase config 唯一複本（無建置頁無法 import npm workspace 包）。
// 正本在 packages/firebase/index.js——改 config 兩處一起改；
// packages/firebase/config-sync.test.js 會驗本檔與正本一致（含 CDN 版本）。
// 這些值屬公開資訊（安全靠 Firestore rules，不靠隱藏 config）。

export const FIREBASE_SDK_VERSION = '12.17.1'; // 需等於 node_modules/firebase 安裝版

export const firebaseConfig = {
  apiKey: 'AIzaSyANpkc1-X1-1VMiPjZLkw_2CeOhc2BVzfk',
  authDomain: 'growth-map-main.firebaseapp.com',
  projectId: 'growth-map-main',
  storageBucket: 'growth-map-main.firebasestorage.app',
  messagingSenderId: '421192696889',
  appId: '1:421192696889:web:ea0d2b14a63709207c79e8',
};

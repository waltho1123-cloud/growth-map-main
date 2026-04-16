# Cloud Sync Setup（Firebase Auth + Firestore）

程式碼已經接好，剩下 Firebase Console 的一次性設定。設定完後我就能把 config 填進程式碼、rebuild、deploy。

## 1. 建立 Firebase Project

1. 前往 <https://console.firebase.google.com>
2. 「Add project」→ 名稱建議 `growth-map-main`（沿用 Zeabur project 名）
3. 可關閉 Google Analytics（此 app 用不到）

## 2. 啟用 Google Auth

1. 左側選單 → Build → **Authentication** → Get started
2. Sign-in method 分頁 → Google → Enable → 選 project support email → Save

## 3. 建立 Firestore

1. 左側選單 → Build → **Firestore Database** → Create database
2. Location：**asia-east1（Taiwan）** 或 **asia-northeast1（Tokyo）**（就近即可）
3. Mode：**Start in production mode**（rules 先封死，等下貼上正確版）

## 4. 貼上 Security Rules

Firestore → Rules 分頁 → 貼上 `firestore.rules` 的內容 → Publish。

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /apps/{doc=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

## 5. 加入 Web App 並取得 config

1. Project Overview → ⚙ Settings → **General** 分頁
2. 底部「Your apps」→ 點「</>」加入 Web app
3. 暱稱隨便填（`growth-map-web`）→ 不勾 Firebase Hosting → Register
4. 顯示的 `firebaseConfig` 就是我要的東西，形如：

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "growth-map-main.firebaseapp.com",
  projectId: "growth-map-main",
  storageBucket: "growth-map-main.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

## 6. 加入 Authorized Domains

Authentication → Settings → Authorized domains → 新增：
- `localhost`（本機開發用）
- Zeabur 正式域名（例：`growth-map-main.zeabur.app` 或你綁的自訂域名）

## 7. 把 config 給我

回到我這邊貼上 `firebaseConfig` 物件內容，我會把它寫進三個 app 的 `src/lib/cloud/firebase-config.*`，然後 rebuild + 部署。

## 什麼時候會「生效」？

- 在 step 7 完成之前：程式碼裡 `isFirebaseConfigured` 回傳 `false`，AuthWidget 隱藏、cloud sync 完全不跑。**使用者完全感受不到差異、localStorage 照常運作**。
- step 7 完成後：AuthWidget 出現右上角，使用者點「以 Google 登入」即啟用同步。

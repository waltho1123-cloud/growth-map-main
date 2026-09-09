# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**成長藍圖實作平台（Growth Blueprint Platform）** — 商周百億 CEO 工作坊的線上實作平台。

一個 repo 內含多個部分。四個前端單元是**同一工作坊的階段性課程（第一～四堂），資料互相關聯**（見下方「跨單元資料流」），只是各自獨立建置部署。前端單元已統一為 **Vite 8**（momentum 為 TypeScript），以 **npm workspaces** 統一管理：root 一次 `npm install`（單一 lockfile，單元不再各自安裝），批次指令見下：

| 路徑 | 內容 | 框架 | 建置輸出 |
| --- | --- | --- | --- |
| repo 根（`index.html` + `css/ js/ data/ pages/`） | Portal 入口站（單元卡片資料驅動自 `data/unit-registry.json`；全站登入膠囊 `js/portal-auth.js`（email／密碼登入，表單與錯誤翻譯共用 `js/auth-ui.js`，見下方「登入方式」）；**平台帳號管理頁 `pages/admin.html`**——帳號與密碼（經後端服務帳號建帳號／設密碼／停用／刪除）＋登入方式設定＋活動目錄／平台封鎖＋AI 白名單＋增補管理員，root 管理員寫死於 firestore.rules；portal 層 Firebase config 唯一複本在 `js/firebase-config.js`（正本 `packages/firebase`，config-sync.test 驗一致＋CDN 版本＝安裝版）；同源共享 session，portal 登入＝四單元登入；**管理員登入後膠囊顯示「帳號管理」連結**（判定＝以登入者身分能否讀 `platform/meta`，與 rules／後端 admin-guard 同源）。portal 層未 hash 的 `js/`／`css/` 由 Caddyfile 送 `no-cache`（ETag 重驗證）；2026-09-09 曾因缺此標頭讓瀏覽器啟發式快取舊 `portal-auth.js` 數天，故 `index.html`／`admin.html` 的模組網址帶一次性 `?v=`。**登入會自動寫 `platformUsers/{uid}` 帳號目錄**（useAuth 內 fire-and-forget）；封鎖帳號＝全平台禁寫（isBlocked 織入所有寫入規則），完全停用走 Firebase Console | 純靜態，Caddy 提供 | 無需建置 |
| `growthmap/opportunity-system/` | 識別機會（第三堂） | Vite 8 + React + Tailwind | `build/`（**要 commit**） |
| `growthmap/aspiration-case/` | 願景 | Vite 8 + React + zustand | `dist/`（要 commit） |
| `growthmap/momentum-case/` | 動能 | Vite 8 + React + TS | `out/`（要 commit） |
| `growthmap/evaluate-strategy/` | 評估策略（第四堂，**多人協作**，2026-08-10 新增） | Vite 8 + React + zustand + Tailwind | `dist/`（要 commit） |
| `growthmap/ido-ai-service/` | AI/BFF 後端 | Node + Hono + Anthropic SDK | 無建置，直接跑 `src/` |
| `packages/contracts/` | 跨單元資料契約 `@growthmap/contracts` | 純 ESM JS + .d.ts | 無建置（`node --test`） |
| `packages/cloud/` | 共用同步協定 `@growthmap/cloud`（load/save/subscribe/reconcile） | 純 ESM JS + .d.ts | 無建置（`node --test`） |
| `packages/pdf/` | 共用 PDF 匯出管線 `@growthmap/pdf`（DOM→多頁 PDF） | 純 ESM JS + .d.ts | 無建置 |
| `packages/firebase/` | 共用 Firebase 層 `@growthmap/firebase`（config/init/auth hook） | 純 ESM JS + .d.ts | 無建置 |
| `packages/ui/` | 共用 UI `@growthmap/ui`（AppErrorBoundary，createElement 免 JSX） | 純 ESM JS + .d.ts | 無建置 |

### 跨單元資料流（改資料欄位前必讀）

三單元共用 Firestore 資料契約 `users/{uid}/apps/{appKey}`，appKey＝`momentum`（第一堂）/ `aspiration`（第二堂）/ `opportunity`（第三堂），資料串成一條管線：

1. momentum-case 寫 `apps/momentum`；aspiration-case 寫 `apps/aspiration`。aspiration 文件另有 **additive** 的 `tamSamSom`（TAM／SAM／SOM 三層：`{ description, size }`，億）與 `partA[].businessModel`（`existing`／`new`，舊資料缺此欄由 UI 依 id 推定），2026-09-10 依講義 p21–37 新增；判讀規則（SAM≠TAM、20% 市佔門檻、四格合計 ≤ SOM）純函式在 `aspiration-case/src/lib/marketLayers.js`。兩者都不在 orient 契約內，消費端可忽略。
2. **opportunity-system 跨單元讀 `apps/aspiration`**（`src/lib/cloud/orient.js`）：取 `data.companyInfo.naturalGrowth.targetRevenue2028`（自然增長）、`data.companyInfo.aspirationGrowth.targetRevenue2028`（加速增長）、`data.partA`（營收拆解），算出成長差距餵給 `GrowthGapDashboard` 與 CHK-1。
3. opportunity-system 的 `HandoffPanel` 快照凍結後交付第四堂。

**風險**：這條契約沒有共用程式碼保護——orient.js 的 fallback 全是 `|| 0`，**改 aspiration-case 的上述欄位名會靜默弄壞第三堂**（儀表變 0、不報錯）。改任一單元寫入的資料形狀前，先 grep 其他單元有沒有讀它。另：同步協定（load/save/subscribe/reconcile）唯一正本在 `@growthmap/cloud`——各單元的 `lib/cloud/sync` 只是綁定自家 firebase 實例的薄轉接層，**修同步 bug 一律改共用包**；三單元現皆為 onSnapshot 即時同步＋防迴授四層（hasPendingWrites／writer=clientId／applying 旗標／內容簽章 onSaved 後記錄）。**momentum 與 aspiration（走 `createCloudSyncBootstrap` factory）另有 section 級 merge**：雲端文件 additive `sectionTs` 記各 top-level section 最後編輯毫秒，兩台裝置並行編輯不同 section 互不覆蓋（`mergeBySection` 純函式，tie 偏本地＋內容比較用 stableStringify 防 Firestore key 排序誤判＋tie-with-diff 破對稱防 ping-pong）；opportunity 仍為 whole-doc reconcile（有 migrate／交付快照 union 獨有層，刻意不併入——不同 appKey 不同文件，兩種語意各自一致）。**Section 刪除走墓碑（tombstone）**：直接刪 `data.{key}` 會被開著的 client 秒級復活——正確的運維刪除是三件一起做：刪 `data.{key}`＋刪 `sectionTs.{key}`＋寫 `sectionTombstones.{key} = Date.now()`（毫秒）。墓碑生效後 ts ≤ 墓碑的殘值不套用、不上傳；使用者在刪除**之後**的新編輯（ts > 墓碑）合法復活該 section 並自動清墓碑；雲端同時有資料與墓碑時資料優先。注意：對 aspiration 的 orient 契約欄位（companyInfo/partA）下墓碑會觸發 dev guard 擋上傳且弄壞第三堂——那些欄位不該刪。**2026-08 起契約已程式碼化為 `@growthmap/contracts`**：`APP_KEYS`、`extractOrientSnapshot`（opportunity 消費端）、`assertOrientProducerShape`（aspiration dev 模式每次上傳前驗形狀，改壞欄位名＝dev console 立即報錯並擋下該次上傳——不炸整個同步，`[cloud sync] guardSnapshot rejected upload` 即此守衛）。三單元的 appKey 與 orient 欄位讀取都必須走契約包，勿再寫字面字串；改契約形狀＝改 `packages/contracts` ＋ 生產/消費兩端同步。

**ADR 更新（2026-08-09 Phase 2d 完成）**：firebase config／lazy init／auth hook 已合一於 `@growthmap/firebase`（盤點確認三份純複製、零行為分歧，單元檔為薄 re-export 保持 import 路徑）；**AuthWidget（登入按鈕 UI）刻意留在各單元**——樣式與版位屬單元自主範圍，僅邏輯層共用。

### 登入方式：email／密碼（2026-09-08 起，取代 Google OAuth）

全平台（portal 膠囊、管理頁、四單元）改用 Firebase **Email/Password** 供應商登入。邏輯唯一正本在 `@growthmap/firebase`：`signInWithEmail`／`sendPasswordReset`／`sendVerificationEmail`／`describeAuthError`（Firebase 錯誤碼→繁中）＋ React hook `useEmailLogin`（欄位、送出、忘記密碼）與 `useEmailVerification`（寄驗證信、「我已驗證」＝reload＋強制刷新 token，讓後續 AI 呼叫帶到新 claim）；無建置的靜態頁（`js/portal-auth.js`、`js/platform-admin.js`）用等價複本 `js/auth-ui.js`（改錯誤文案兩處一起改；config-sync.test 驗其 CDN 版本）。表單樣式仍屬各單元（AuthWidget／LoginGate），與 Phase 2d 的 ADR 一致。

**email 信任邊界（改登入方式的安全後果，勿回退）**：email／密碼帳號的 email 是填寫者自稱，未點驗證信前不可信。凡以 email 授權的地方一律要求 `email_verified == true`：firestore.rules 的 `hasVerifiedEmail()`（`isPlatformAdmin`、第四堂 `isInvited`／`isSelfJoin`）與後端 `evaluateCaller`（AI 白名單；在名單但未驗證回 403 `IDO_EMAIL_UNVERIFIED`）。未驗證帳號仍可登入、使用單元一～三與自己建立的第四堂專案。Google 時代建立的帳號（2026-09-08 盤點 7 個）本來就已驗證。`platformUsers/{uid}` 多寫 `emailVerified`，管理頁對未驗證者顯示標記。

**帳號與密碼統一由管理員控管（做法 A，2026-09-08 裁定）**：平台不提供自助註冊；學員端登入表單不提供「忘記密碼」（顯示「請聯絡平台管理員」，只有管理頁登入表單保留重設信給管理員自助）。管理員在 `pages/admin.html` 的「帳號與密碼」卡建帳號、指定／重設密碼、停用／啟用，在「登入方式設定」卡一鍵啟用 Email/Password 供應商＋關閉自助註冊——全部經後端 `/api/admin/*` 以 **Firebase 服務帳號**代辦（Identity Toolkit REST；`src/service-account.js` 以 Node crypto 簽 jwt-bearer 換 OAuth token，仍不引入 firebase-admin）。管理員建立或設密碼的帳號一律 `emailVerified=true`（管理員背書），rules／AI 白名單的驗證守門直接放行。既有 Google 帳號由管理員直接設密碼（uid 不變、資料不動）。管理員身分後端不另存名單：`src/admin-guard.js` 用呼叫者 token 探測 `platform/meta` 可讀與否，正本仍是 firestore.rules。**刪除帳號**（2026-09-09）：需在請求重打目標 email、不能刪自己；Auth 先刪，再以同一把服務帳號走 Firestore REST 刪 `platformUsers/{uid}`（一定）與 `users/{uid}` 工作簿整棵樹（`purgeData` 勾選才刪，`src/admin-firestore.js` 遞迴含子集合、2000 份文件安全閥）；Firestore 清理失敗不回滾、以 `purge.error` 回報。第四堂 evalProjects 成員資格不動。

**Bootstrap（金鑰只存 Zeabur，不進 git／對話）**：Firebase Console → 專案設定 → 服務帳號 → 產生新的私密金鑰 → 整份 JSON 存 Zeabur 後端環境變數 `FIREBASE_SERVICE_ACCOUNT_JSON` → 重新部署後端 → 在容器內跑 `node scripts/auth-admin.mjs configure`（`zeabur service exec`；啟用 Email/Password＋關閉自助註冊）→ root 管理員用管理頁登入表單的「忘記密碼」設自己的密碼 → 之後全由管理頁操作。CLI 另有 `status`／`list`／`set-password <email>`（密碼走 `NEW_PASSWORD` 環境變數）／`verify-email <email>`／`delete <email> [--purge-data]`／`google-provider <enable|disable>`。**Google 供應商已於 2026-09-09 關閉**（admin v2 `defaultSupportedIdpConfigs/google.com` enabled=false；帳號與資料不動），管理頁「登入方式設定」卡可重新啟用；`auth-config` 回 `googleEnabled`。未設金鑰時 `/api/admin/*` 回 503 `IDO_ADMIN_NOT_CONFIGURED`，其餘功能不受影響。

### 第四堂（evaluate-strategy）——多人協作模型，與單人模型刻意分離

第四堂承接第三堂交付快照做「評估策略」（四維評分 → 2×2 矩陣短名單 → 編組 1–3 個策略方案 → 財務三表 → 疊加達標 → 交付第五堂），PRD 正本在 Dropbox《成長藍圖平台_評估策略模組_PRD_v1.0》。與單元一～三的三個關鍵差異：

1. **資料模型是共享專案，不是單人工作簿**：`evalProjects/{projectId}` 主文件（成員/邀請/criteria/settings/synergies/consensus）＋子集合 `opportunities`／`rounds`／`scores`／`plays`／`assumptions`／`handoffs`。存取閘門是 `memberUids`。**授權邊界（2026-08-10 對抗式審查後硬化，正本在 firestore.rules 註解）**：membership 欄位（members/memberUids）owner-only；邀請欄位 owner/facilitator；自助加入（isSelfJoin）只能消耗自己的邀請、角色鎖 inviteRoles[email]、不得夾帶其他邀請；coach 全面唯讀；`rounds` 主持人限定且 **docId＝輪次號**（score 規則靠它查輪次開放）；`scores` docId 綁 `{oppId}__r{round}__{uid}`、輪次開放才可寫、提交後鎖定（主持人只能翻 submitted 旗標解鎖）；`handoffs` owner-only create、docId 綁版本號、不可變。業務子集合（opportunities/plays/assumptions）刻意維持 **trusted-editor 邊界**——schema 與數值完整性不下沉到 rules，本系統防「誤操作」不防「惡意成員」（內部單租戶裁定）。**改 firestore.rules 後必須部署**（`npx firebase-tools deploy --only firestore:rules`）——rules 沒上線第四堂整個不能用。
2. **同步不走 `@growthmap/cloud`**：多人並行編輯用「細粒度文件＋onSnapshot」直訂閱（`src/lib/db.js` 是唯一讀寫面）；**主文件上的 criteria/settings/consensus/synergies 一律 field-path update（`criteria.anchors.size.5` 這種粒度），禁止讀舊物件整包覆寫**——防兩人並行編輯的 lost-update（對抗式審查 P2）。`@growthmap/cloud` 的 section merge/reconcile 仍只屬單元一～三。登入為硬需求（無離線後援語意）。**文件大小護欄**：play 文件與交付快照有 1MiB 上限風險，`approxJsonBytes`＋`FIRESTORE_DOC_SOFT_LIMIT`（900KB）在 P-09 警示、P-14 凍結前硬擋。
3. **跨單元讀取走 handoff 契約**：`@growthmap/contracts` 新增 `extractHandoffSnapshot`／`listHandoffVersions`／`assertHandoffProducerShape`（生產端＝opportunity-system `utils/handoff.js`（dev 模式建快照即驗形狀）、消費端＝evaluate-strategy `src/lib/import.js`）。承接語意（三段）：文件 id `imp-{sourceId}`；重新同步 (1) 補新機會 (2) 不覆寫既有補件 (3) **上游修正偵測**——`upstreamFingerprint` 比對，變了就標 `staleUpstream`＋存 `upstreamPending`，P-02 逐列「套用上游／保留本地」人工合併。`targetSnapshot` 差距核心值優先取快照內建、缺了 fallback 讀 apps/aspiration（orient 契約）。

單元內結構：`src/domain/`（純函式：scoring/matrix/guards/finance/rollup/sequencing/checks/model/workshop＋criteria，Vitest 測試在 `src/__tests__/`）、`src/lib/`（db/import/ai/events/format/useHashRoute）、`src/store/`（zustand 即時鏡像＋useSyncStatus 寫入追蹤）、`src/components/pages/`（P-01～P-17 對應 PRD 頁碼）。**R4/R5 已於 2026-08-10 補齊**：P-06 工作坊主持台（`workshop/1`、`workshop/2`；匿名投票採 PD-08 半記名——原始票 `wsVotes` 僅主持人與本人可讀、主持人端彙總 tally 回寫 workshop 文件）、P-15 AI 四模式抽屜（後端 `EVA-HAT/EVA-REDTEAM/EVA-REVERSE/EVA-SCAN` 任務，GR-8 強制編輯後採納→轉「AI 假說」假設，稽核進 `aiLogs`）、P-17 進度看板＋評論（`comments` 是 coach 唯一可寫面）、成熟度 50/70/90、矩陣 PNG、NPV 選填、PPTX 結構輸出（pptxgenjs 動態載入）、EVT 埋點（`events` 子集合 append-only）。輸出：PPTX＋PDF（`@growthmap/pdf`）＋JSON。

## 常用指令

```bash
# Workspace 根（repo 根執行）
npm install                                  # 一次裝全部 workspace（唯一的安裝入口）
VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run build   # 三單元全建
npm test                                     # 全 workspace 測試（contracts/cloud/opportunity）
npm run lint                                 # 三單元 lint（基線全綠）
VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run preflight   # 部署前必跑：test+lint+build 全綠才准 deploy
# 建置產物入版控＋Tailwind v4 自動掃描：三個 v4 單元的 CSS 入口有 `@source not "../dist"`（momentum 為 ../../out），
# 否則上一次的 bundle 會被當 class 來源、hash 延遲一個週期才穩定（2026-09-09 根因）。opportunity 是 Tailwind v3（content 明列）不受影響。
# preflight 開頭有兩個前置 gate（scripts/）：check:env 未帶 VITE_AI_BASE_URL 直接 fail（防 GD-06 靜默停用）；
# check:react 掃全 workspace 任意深度的巢狀 react/react-dom 副本（防兩個 React 實例白屏，修法 npm explain react）

# opportunity-system（在 growthmap/opportunity-system/）
npm start                                    # Vite dev server :5173
npm test                                     # Vitest 跑一次（preflight 用；測試在 src/__tests__/）
npm run test:watch                           # watch 模式（開發用）
npm run lint                                 # eslint（0 error 為基線）
VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run build   # 正式建置（見下方「關鍵」）
# 瀏覽器支援下限明訂於 vite.config.mjs 的 build.target；Node ^22.22.2 || ^24.15.0 || >=26（engines）
# build 內建 eslint gate（0 error 才建置）；PDF 字型走 public/fonts 穩定路徑（部署相容契約，勿改 hashed）

# ido-ai-service（在 growthmap/ido-ai-service/）
npm run dev                                  # --watch + 讀 .env（需 ANTHROPIC_API_KEY）

# aspiration-case：npm run dev / npm run build / npm run lint（eslint）
# momentum-case：npm run dev / npm run build（tsc → eslint → vite 三重 gate）/ npm run lint
# evaluate-strategy：npm run dev / npm test（Vitest，domain 純函式）/ npm run build（eslint gate → vite）
# portal 本機預覽（repo 根）：python3 -m http.server 8000
```

## 部署（Zeabur，direct deploy 非 git 連動）

Zeabur 專案 `growth-map-main`：project-id `69a70ecee10515e35593d1c2`、env `69a70ecea2c1609bd1efd98a`。**`zeabur deploy` 上傳的是目前工作目錄**：前端站（prod／staging）一律在 repo 根執行、後端一律在 `growthmap/ido-ai-service` 執行；同一串指令切了目錄後要切回來——2026-09-09 曾把後端目錄上傳到 staging 前端服務（整站 404、根路徑變成健康檢查 JSON），重新從 repo 根部署即恢復。部署後用「只有新版才有的檔案 md5」輪詢確認，勿只信 CLI 的 deployed successfully。兩個 Dockerfile 的基底映像走 `mirror.gcr.io/library/*`（Docker Hub 鏡像）：Zeabur 建置機直拉 docker.io 會遇 429 限流（2026-09-08 連兩次 build failed），勿改回。**push GitHub 不會觸發部署**，改完必須手動 deploy。重新部署**務必帶 `--service-id`**，否則會建出重複服務：

| 服務 | service-id | URL | 內容 |
| --- | --- | --- | --- |
| 前端站（prod） | `69e22e6fe3efc3fd3558607b` | https://growth-map-main.zeabur.app | 根 `Dockerfile`（Caddy :8080）+ portal + 三單元 build 輸出 |
| 前端站（staging） | `6a78b194e4a69d66638d7cb4` | https://growthmap-staging.zeabur.app | 同一份 Dockerfile／build 輸出，先驗後上 |
| 後端 | `6a2591b7f1be9943f1f9d17b` | https://growthmap-ai.zeabur.app | Node/Hono AI/BFF |

```bash
# 前端站 staging（repo 根執行）
npx zeabur@latest deploy --project-id 69a70ecee10515e35593d1c2 --service-id 6a78b194e4a69d66638d7cb4
# 前端站 prod（repo 根執行）
npx zeabur@latest deploy --project-id 69a70ecee10515e35593d1c2 --service-id 69e22e6fe3efc3fd3558607b
# 後端（在 growthmap/ido-ai-service 執行）
npx zeabur@latest deploy --project-id 69a70ecee10515e35593d1c2 --service-id 6a2591b7f1be9943f1f9d17b
```

**改前端 `src` 後的完整流程（五步缺一不可，staging 先行）**：

0. **root `npm run preflight` 全綠**（帶 `VITE_AI_BASE_URL`）；行為級變更另跑 Playwright smoke（見 `scripts/smoke.md`）。

1. 重 build，且**必須帶 `VITE_AI_BASE_URL`**（Vite 是建置時注入；漏設則線上 AI 功能整組停用——GD-06 優雅降級，不會報錯，容易漏察覺）。
2. **先部 staging**，在 staging 網址跑 Playwright 線上 smoke（登入用 email／密碼測試帳號即可自動化——見下方備註）。
3. smoke 綠了才部 prod 服務（`.zeaburignore` 只打包 build 輸出，排除 `src/`、`node_modules`、`.map`、`*.md`）。
4. **commit `build/` 進 git**——本 repo 刻意把建置產物入版控，維持「GitHub = 線上」的同步慣例。

> staging 備註：後端 `ALLOWED_ORIGINS` 已含 staging origin（`https://growthmap-staging.zeabur.app`）；Firebase Authorized domains 已含 `growthmap-staging.zeabur.app`（2026-09-08 以公開 config 端點確認）。登入為 email／密碼，Playwright 可用測試帳號直接登入（Google OAuth 擋 CDP 瀏覽器的限制已不存在）；純 UI/資產類變更在 staging 可不登入驗證。

前端站線上路徑：opportunity-system 於 `/growthmap/opportunity-system/build/`、evaluate-strategy 於 `/growthmap/evaluate-strategy/dist/`。

### 維運護欄（2026-09-09 補強）

- **Firestore 每日備份**：backupSchedule `e76c342a-dc69-404e-a8cb-9c511882191d`（dailyRecurrence，保留 7 天，UTC）。還原走 Firebase Console → Firestore → 備份，或 Firebase MCP／`gcloud firestore backups`。
- **PITR 已開啟（2026-09-09 07:00Z，識別機會資料覆寫事故後）**：`versionRetentionPeriod` 由 1 小時變 7 天（1 小時內任意時間點、之後每分鐘快照）。單一文件還原：容器內 `node scripts/firestore-restore.mjs <docPath> <readTime ISO> [--apply]`（服務帳號；先檢視摘要再 --apply；會存 `restoreBackups/` 並把 updatedAtMs 設為現在）。readTime 選「事故前最後完整版本存活區間的較晚時刻」。**Delete protection 已開啟**（2026-09-09 07:05Z）：刪除資料庫前須先在 Console／API 關閉保護。
- **健康檢查監控**：GitHub Actions `health-check`（`.github/workflows/health-check.yml`）每 10 分鐘探測後端 `/`（`ok`／`apiKeyValid`／`adminConfigured` 皆須 true）與前端站 200；失敗＝workflow 紅燈（GitHub 寄信）＋開／更新 issue「🚨 線上健康檢查失敗」，恢復自動關閉。**公開 repo 60 天無 commit 會被 GitHub 暫停排程**，需到 Actions 頁重新啟用。
- **CI**：`preflight` workflow 在 push／PR 跑 root preflight（含四單元建置）與 `npm run test:rules`；部署仍手動（刻意）。
- **rules 自動化測試**：`tests/rules/firestore.rules.test.mjs`（`@firebase/rules-unit-testing`＋Firestore 模擬器，`npm run test:rules`，需 Java 21——本機沒有 Java 就靠 CI）。覆蓋 platformUsers 欄位白名單、管理員 email_verified、第四堂邀請／自助加入／提權、scores docId 綁定、adminLogs 只讀。改 rules 必加案例。
- **管理操作稽核**：後端所有管理變更（建帳號／設密碼／停用／啟用／刪除／登入方式／Google 供應商，含 CLI）寫 Firestore `adminLogs/{autoId}`（`{ at, actorUid, actorEmail, action, targetUid, targetEmail, detail }`），rules 只讓管理員讀、client 不可寫；管理頁「管理操作紀錄」卡讀最近 50 筆。
- **第四堂多人流程 UAT（自動化）**：`scripts/uat-evaluate-multiuser.sh [base-url]`——兩個 smoke 帳號、兩個獨立 Playwright session：owner 建專案 → 設定頁邀請 → member 自助加入 → 雙方看到成員（2）→ owner 刪除 → member 端消失。需 `smoke.env` 另有 `SMOKE2_EMAIL`／`SMOKE2_PASSWORD`（帳號 `platform-smoke-2@growth-map-main.zeabur.app`）。
- **登入 e2e smoke**：`scripts/smoke-login.sh [base-url]`——用 smoke 專用帳號 `platform-smoke@growth-map-main.zeabur.app`（管理員建立、不在 AI 白名單、無資料、**勿刪**）登入 portal → 第四堂通過登入閘門 → 第三堂同步膠囊 → 登出。帳密只放本機 `~/.config/growthmap/smoke.env`（chmod 600），不進 repo／對話。動到登入或 firebase 包時必跑。
- CLI 新增 `create <email> [名稱]`（`NEW_PASSWORD` 環境變數帶密碼），與管理頁建帳號同義。

### 後端環境變數（存於 Zeabur，非 git）

| 變數 | 說明 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 必填，否則 AI 端點回 503 |
| `ANTHROPIC_BASE_URL` | 選填（自訂上游/代理） |
| `MODEL_OPUS` / `MODEL_SONNET` / `MODEL_HAIKU` | 模型字串，預設 `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5` |
| `ALLOWED_ORIGINS` | CORS 白名單 CSV（fail-closed）。線上＝`https://growth-map-main.zeabur.app`（staging 建立後追加其 origin） |
| `REQUIRE_AUTH` | `true` 時強制 Firebase 登入 |
| `ALLOWED_EMAILS` | AI 端點 email 白名單 CSV——**保底名單**（日常增刪走管理頁 `pages/admin.html` 的 AI 白名單卡，存 Firestore `platform/aiAllowlist`，後端以呼叫者 token 走 REST 讀取＋60s 快取，兩者**聯集**生效）。聯集非空即強制：名單外 403 IDO_FORBIDDEN；聯集為空＝不限制（啟動 console.warn）。環境變數至少留管理員 email，防管理頁誤清空後限制整個關掉。名單比對之外還要求 token `email_verified == true`（`evaluateCaller`），未驗證回 403 `IDO_EMAIL_UNVERIFIED` |
| `ALLOWED_EMAIL_DOMAINS` | AI 端點 email 網域白名單 CSV（保底；如 `corp.tw`，嚴格比對、子網域不放行；管理頁亦可設網域） |
| `FIREBASE_PROJECT_ID` | 驗 token aud/iss 用 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 選填。Firebase 服務帳號金鑰（整份 JSON 或 base64）；設了才開 `/api/admin/*`（管理頁的帳號／密碼／登入方式）。Console「產生新的私密金鑰」的 firebase-adminsdk 帳號權限即足夠 |
| `PORT` | 預設 8787（線上由平台給 8080） |

## API 規範 — ido-ai-service

Base URL：`https://growthmap-ai.zeabur.app`。框架 Hono。所有 AI 產出皆為 **draft（建議稿）**，前端**人在迴路採納後才生效**（ADR-004 / GD-04），**後端不寫任何業務資料**（例外：`/api/admin/*` 以服務帳號管理 Firebase Auth 帳號——身分層，非業務資料）。

### 中介層（順序）
1. **CORS**（`/*`）：來源限 `ALLOWED_ORIGINS`（CSV）。**fail-closed**：未設＝不允許任何跨來源（防止變成公開的 Anthropic proxy）；要全開須顯式設 `*`。
2. **Auth**（`/api/*`）：`REQUIRE_AUTH=true` 時驗證 `Authorization: Bearer <Firebase ID token>`。OPTIONS 預檢免 token。驗證成功將 `{ uid, email }` 放入 context。
3. **Rate limit**（`/api/*`）：in-memory、per-IP、**20 次/分**，超過回 429。
4. **Admin guard**（`/api/admin/*`）：email 已驗證＋firestore.rules 認定的平台管理員（`admin-guard.js` 探測 `platform/meta`，60s 快取）＋服務帳號已設定；此組端點不套 AI 白名單。

### 端點

| 方法 | 路徑 | 用途 | 串流 |
| --- | --- | --- | --- |
| GET | `/` | 健康檢查 → `{ ok, service, hasApiKey, apiKeyValid, adminConfigured }`（`apiKeyValid` 以免費的 GET /v1/models 探測、1 小時快取：true／false／null；沒有 `/health` 路由） | — |
| POST | `/api/ai/tasks` | AI-01 / AI-02 / AI-03 / AI-04（非串流任務） | 否 |
| POST | `/api/ai/coach` | AI-07 教練對話 | SSE |
| GET | `/api/admin/accounts` | 帳號清單 `{ accounts:[{uid,email,displayName,emailVerified,disabled,providers,createdAt,lastLoginAt}] }` | 否 |
| POST | `/api/admin/accounts` | 建帳號 `{ email, password(8–128), displayName? }` → 201 `{ account:{uid,email} }`；emailVerified=true | 否 |
| POST | `/api/admin/accounts/:uid/password` | 設密碼 `{ password }`（並標 email 已驗證） | 否 |
| POST | `/api/admin/accounts/:uid/disabled` | 停用／啟用 `{ disabled: boolean }`（不能停用自己） | 否 |
| POST | `/api/admin/accounts/:uid/delete` | 刪帳號 `{ confirmEmail, purgeData?: boolean }` → `{ ok, deleted:{uid,email}, purge:{platformProfile,userDocs,error?} }`；不能刪自己 | 否 |
| GET／POST | `/api/admin/auth-config` | 讀／套用登入方式：POST `{ disableSignup?: true, googleEnabled?: boolean }` → 啟用 Email/Password＋關閉自助註冊（＋開關 Google 供應商）；GET 回 `{ emailPasswordEnabled, signUpDisabled, googleEnabled, authorizedDomains }` | 否 |

**`POST /api/ai/tasks`**：Request `{ "taskCode": "AI-01|AI-02|AI-03|AI-04", "input": {...} }` → Response `{ taskCode, state: "draft", payload, confidence, model, usage }`。後端流程：`sanitizeObject(input)` → `callClaude(tier, system, buildUser)` → JSON 解析（含容錯擷取 `{...}`）→ `normalize`。

**`POST /api/ai/coach`**（SSE）：Request `{ "messages": [{ "role": "user|assistant", "content": "..." }] }`。SSE 事件：`coach.delta {delta}`、`coach.done {ok}`、`coach.error {message}`。

### 錯誤格式

統一 `{ "error": { "code", "message" } }`：

| code | HTTP | 意義 |
| --- | --- | --- |
| `IDO_PERMISSION_DENIED` | 401 | 缺 Bearer token |
| `IDO_TOKEN_INVALID` | 401 | token 無效/過期（前端會強制刷新後重試一次） |
| `IDO_FORBIDDEN` | 403 | email 不在 AI 白名單（`ALLOWED_EMAILS`/`ALLOWED_EMAIL_DOMAINS` ∪ 管理頁名單） |
| `IDO_EMAIL_UNVERIFIED` | 403 | email 在白名單但 token `email_verified` 非 true（email／密碼帳號尚未點驗證信） |
| `IDO_RATE_LIMIT` | 429 | 超過 20/min |
| `IDO_AI_NO_KEY` | 503 | 伺服器未設 `ANTHROPIC_API_KEY` |
| `IDO_AI_KEY_INVALID` | 503 | 上游回 401/403：`ANTHROPIC_API_KEY` 無效或已撤銷（2026-09-09 事故：Zeabur 上的舊金鑰失效，健康檢查 `hasApiKey` 只驗有無設定所以看不出來）；同時強制重探 apiKeyValid |
| `IDO_VALIDATION` / `IDO_VALIDATION_TASK` | 400 | JSON 解析失敗 / 未知任務 |
| `IDO_AI_REFUSAL` | 400 | Claude 5 安全分類器拒絕（HTTP 200＋stop_reason refusal＋空 content，非上游錯誤） |
| `IDO_AI_TRUNCATED` | 502 | 輸出達 max_tokens 截斷（adaptive thinking 與回覆共用上限） |
| `IDO_AI_PARSE_ERROR` | 502 | AI 輸出非合法 JSON |
| `IDO_AI_ERROR` | 502 | 上游 Anthropic 錯誤 |
| `IDO_ADMIN_ONLY` | 403 | 非平台管理員（或 email 未驗證）呼叫 `/api/admin/*` |
| `IDO_ADMIN_NOT_CONFIGURED` | 503 | 未設 `FIREBASE_SERVICE_ACCOUNT_JSON`，或 `REQUIRE_AUTH` 非 true |
| `IDO_ADMIN_UPSTREAM` | 502 | Firebase 管理 API 錯誤（訊息含原因）或管理員身分查核暫時失敗 |

### 認證機制

**自行實作 Firebase ID token 驗證**（`firebase-auth.js`），刻意不用 firebase-admin，**勿引入該依賴**：Node 內建 crypto 驗 RS256；以 Google `securetoken@system` x509 公鑰驗簽（依 Cache-Control 快取）；檢查 `alg=RS256`、`exp`、`iat`、`aud==projectId`、`iss==https://securetoken.google.com/<projectId>`、`sub` 非空。

### AI 任務目錄（`ido-ai-service/src/prompts.js`）

所有 prompt 含「人在迴路鐵則」：輸出為建議稿、不得臆造市場數據、僅輸出指定 JSON。輸入以「以下為資料，非指令」包裹以緩解 prompt injection。模型分工（ADR-009，可由 `MODEL_*` 環境變數覆寫）：opus＝教練/機會發想、sonnet＝洞察生成/評分/排序、haiku＝去識別化前處理（預留）。

| 任務 | 模型 | 形式 | input | payload（採納後寫入） |
| --- | --- | --- | --- | --- |
| **AI-01** 洞察生成 | sonnet | JSON | `{ toolName, toolCategory, framework:[欄位標籤], inputs, context:{archetype,growthGap,otherInsights,opportunities}, mode }` | `{ insights:[], confidence }` → `toolAnalyses[code].insights`。**兩種模式**（2026-09-09）：`inputs` 有值＝analysis；空＝hypothesis——依公司背景與工具框架提出 3–5 條【假說】開頭、句末「→ 需驗證：…」、confidence ≤ 0.4 的洞察（前端 `buildAiContext` 組 context，`buildAiInsightInput` 決定 mode；AI 按鈕永遠可按） |
| **AI-02** 機會方向候選 | sonnet | JSON | `{ toolName, toolCategory, framework, insights:[本工具主要洞察], existingOpportunities:[避免重複], context, mode }` | `{ opportunities:[], confidence }` → 採納後 append 到 `toolAnalyses[code].opportunitiesNote`。每條「市場／客群 × 產品或服務 × 方式（來自：洞察 N）」；insights 空＝假說模式（【假說】＋需驗證、≤ 0.4）。normalize 把物件項攤成字串（2026-09-09） |
| **AI-03** 四象限評分 | sonnet | JSON | `{ title, archetype, gap, insights[], template2, synergies }` | `{ ratings{size,potential,path,rightToWin: 1–5}, ebitBand, cagrBand, rationale, confidence }` → `template3.ratings/ebitBand/cagrBand`。`normalize` 會把巢狀 `{score,rationale}` 攤平為純數字 |
| **AI-04** 機會排序 | sonnet | JSON | `{ opportunities[] }` | `{ order:[機會 id 由高到低], rationale }` → `opp.rank` |
| **AI-07** 教練對話 | opus | SSE | `{ messages[] }` | 不持久化（即時對話） |

> ⚠️ **gotcha**：AI-03 的 `rationale` 與 AI-07 的對話**不會被持久化**（採納四象限評分時只存 `ratings/ebitBand/cagrBand`）。匯出 PDF 等下游因此取不到 rationale。

## 前端架構 — opportunity-system

Vite + React，`src/` 依功能分目錄。流程：**工具分析 → 新增機會（模板一二三）→ 綜合檢查 → 交付**。

### 元件流（`src/components/`）
- **Dashboard/**：機會長清單首頁。`Dashboard.jsx`（新增機會、進度列、匯出 PDF）、`GrowthGapDashboard.jsx`（讀第二堂成長差距）、`OpportunityTable.jsx`、`AiRankPanel.jsx`（AI-04）。
- **Editor/**：`OpportunityEditor.jsx` 容器 + `TabOne/TabTwo/TabThree.jsx` ＝ 模板一/二/三（TabThree 含四象限 AI 評分）。
- **Tools/**：`ToolLibrary.jsx`、`ToolAnalysis.jsx`（AI-01 洞察）、`DynamicField.jsx`。
- **Check/**：`CheckPanel.jsx`（CHK-1~5 規則引擎，`utils/checkEngine.js`）。
- **Handoff/**：`HandoffPanel.jsx`（快照凍結、交付第四堂）。
- **ai/**：`AiSuggestionCard.jsx`（人在迴路採納卡）、`CoachDrawer.jsx`（AI-07）。

### 狀態與資料模型
- **Context**：`OpportunityContext`（state + reducer + 雲端同步，唯一 state 來源）、`NavContext`（導覽）。
- **State**：`{ opportunities[], projectMeta, toolAnalyses, lastCheckRun, longlistSnapshots, editingId }`。
- **資料模型**（`utils/schema.js`，`SCHEMA_VERSION = 3`）：
  ```
  opportunity = {
    id, opportunityName, status, estRevenue, currency, usedTools[], aiScore, rank,
    template1: { companyType, growthDimension, growthLever, growthType[], insights },
    template2: { concept, method, targetCustomer, usp,
                 goToMarket:{rnd,production,pricing,marketing,channel,logistics,afterSales}, steps,
                 /* 舊欄位 goToMarketStrategy/implementationSteps 保留相容 */ },
    template3: { marketSize, unitPrice, competitiveEnvironment, topBrandsShare,
                 currentScale, cagr, ebitMargin, requiredInvestment, potentialHurdles,
                 successFactors, coreCapabilities, synergies /* 2026-09-10 講義 p102：操作潛力＝從綜效去思考 */,
                 ratings:{size,potential,path,rightToWin /* 0–5 */}, points, ebitBand, cagrBand }
  }
  toolAnalyses[code] = { inputs, insights[], opportunitiesNote[], status, updatedAt }
  ```
- **Migration**：`migrateData` / `migrateOpportunity` 為**冪等純增量補欄位**，不刪既有資料；新欄位與舊扁平欄位**並存**是刻意的漸進切換設計，勿「順手清理」舊欄位。各層先展開原物件再列舉已知欄位——**未列舉的鍵原樣保留**（2026-09-10 起）。
- **附加欄位協定（2026-09-10，Codex 對抗式審查後立；正本 `utils/additiveFields.js`）**：opportunity 文件是 whole-doc 覆寫，舊版分頁的 migration 若丟掉新欄位再整份寫回＝靜默資料遺失（已重現：新版寫 synergies → 舊版套用並回存 → 新版讀回變空）。兩層防護：(1) **firestore.rules 對 `users/{uid}/apps/opportunity` 要求 `data.schemaVersion ≥ 3`**（`opportunitySchemaOk()`），舊版客戶端被拒寫，新版收到 `permission-denied` 顯示「版本已過期，請重新整理」；(2) 純量附加欄位語意：**鍵不存在＝寫入者不認得，空字串＝使用者清空**——`migrate` 不得對它補預設值；`applyCloud` 以本地值補回缺鍵並回寫修復，reconcile 的 upload 分支先從雲端補回再上傳（`carryOverAdditiveFields`，路徑清單 `ADDITIVE_OPPORTUNITY_FIELDS`）。**新增純量欄位的 SOP**：加進 `ADDITIVE_OPPORTUNITY_FIELDS`、migrate 不補預設、`SCHEMA_VERSION` 與 rules 最低版本同步提升、**先部署前端再由使用者部署 rules**、補 `tests/rules` 與 `src/__tests__/additiveFields.test.js` 案例。任何繞過 app 的客戶端寫入（如 localhost 一次性匯入頁）也必須寫 `data.schemaVersion ≥ 3`。
- **狀態機**：`draft → insight_linked → evaluated → shortlisted → handed_off → archived`。
- **檢查引擎（CHK）**：例 CHK-1 機會營收總和 ≥ 成長差距 × 緩衝係數（預設 1.2，可於設定頁調整，ADR-010）；CHK-4 長清單合格數 7–12。資料一變動即令上次檢查失效。 **金額單位契約（2026-09-09 立，正本 `utils/amount.js`）**：第二堂所有營收欄位以「億」填寫 → `targetSnapshot.aspiration／momentum／growthGap` 皆為億；第三堂 `estRevenue` 以「元」填寫（既有資料全為元）。CHK-1、交付面板、PDF 顯示前一律以 `toYi()` 把元換算成億再比對／並列，顯示保留小數（`fmtAmount`）——修正前 CHK-1 拿元總和直接除以億差距，永遠 pass。
- **BCG 工具庫**（`utils/toolLibrary.js`）：24 工具，**17–24 啟用（內部洞察）**、1–16 預留（外部觀察）。資料驅動（ADR-007 / GD-08）。**1–16 的 fieldSchema 是 2026-09-09 起草的「草案欄位」**（`fieldSchema.draft=true` 為主持人用的內部旗標，**畫面不顯示**——2026-09-09 使用者裁定學員端不該看到「草案」字樣；Dropbox 與 repo 都沒有 BCG 原始方法論規格，欄位依標準策略框架設計，主持人確認後把該工具的 draft 移除、要改欄位直接改 toolLibrary.js），仍 `defaultEnabled:false`。外部工具的分析頁另保留「觀察資料／研究筆記」自由欄（`inputs.notes`，隨既有同步）作為萬用出口；`utils/toolAiInput.js` 的 `buildAiInsightInput` 決定 AI 按鈕可否按（至少一個欄位有值，或筆記 ≥ 20 字；內部工具只看欄位），並把有值欄位＋筆記一起餵 AI-01；**什麼都沒填時 AI 仍可按**，改走假說模式（見 AI-01 任務說明），按鈕文字變「請 AI 依公司背景提出假說洞察」並顯示琥珀提示（2026-09-09 使用者裁定）。

### 持久化與雲端即時同步
- **本地**：localStorage，key `bw_opportunity_v2`（`utils/storage.js`）。
- **雲端**：Firestore 文件 `users/{uid}/apps/opportunity = { data, updatedAtMs, updatedAt, version, writer }`（`lib/cloud/sync.js`）。`firestore.rules` 限本人讀寫。
- **即時同步（onSnapshot）**：`OpportunityContext` 訂閱雲端文件，其他裝置變更約 1 秒自動套用。防回授三層：
  1. 每裝置 `clientId` 寫入文件，略過 `writer===自己` 的回送；
  2. 略過 Firestore `hasPendingWrites`（自己未確認的樂觀寫入）；
  3. **內容簽章**分辨「使用者編輯」vs「套用快照」，後者不回寫。
- **衝突解析**：`reconcile()` — `localTs===0`（本 session 未動）→ 取雲端；雲端較新 → 取雲端；否則上傳。並發編輯為 **last-write-wins**。交付快照（longlistSnapshots）以 version union 保留。**localTs 只能由真正的使用者編輯推進**：儲存效果在初始掛載（把 localStorage 原樣落地）與內容未變的重繪時不得更新 localTs（`lastSavedSigRef`）——2026-09-09 事故：staging 瀏覽器（本機狀態全空）登入後被判成「比雲端新」，整份上傳蓋掉 19 個機會與工具分析；靠 Firestore 1 小時版本保留（無 PITR）用服務帳號 `scripts/firestore-restore.mjs <docPath> <readTime> --apply` 還原（讀舊版本→存 `restoreBackups/`→寫回並把 updatedAtMs 設為現在）。事故後 opportunity 每次頁面載入都會產生新 clientId，多次重新整理＝多個 writer 連續覆寫是同一台瀏覽器。單元一、二走 `@growthmap/cloud` 的 zustand subscribe 追蹤（掛載不觸發），當日未受影響。

### 匯出 PDF（`utils/pdfExport.js`，jsPDF）
- 結構化報告：封面 → 每個機會的模板一/二/三（含四象限評分視覺化、EBIT/CAGR 分級、AI 排序/評分/狀態）→ 工具分析洞察頁（AI-01）→ Long-list 總表。
- 換頁機制：`measureField`（單一高度公式）、`addField`（依實際行數換頁、超長逐行跨頁）、`addBlock`（標題列與第一欄位一起換頁，避免孤兒）。

## 關鍵決策摘要（ADR / GD）

- **ADR-004 / GD-04**：AI 一律輸出 draft，使用者採納後才寫入 state。改任何 AI 流程都不得違反。
- **GD-06**：未設 `VITE_AI_BASE_URL` 則 AI 優雅降級（停用、不報錯）。
- **ADR-007 / GD-08**：BCG 工具庫資料驅動。
- **ADR-009**：模型字串全部環境變數可配置。
- **ADR-010**：CHK-1 緩衝係數可於設定頁調整（預設 1.2）。
- **Fail-closed CORS**：避免忘設 `ALLOWED_ORIGINS` 變成對外全開的付費 Anthropic proxy。
- **自實作 Firebase token 驗證**：免 firebase-admin 重依賴，用 Node crypto 驗 RS256。

## 本機開發注意

- **登入為 email／密碼**（2026-09-08 起），不走 OAuth，不受 Firebase Authorized domains 限制，`localhost` 或 `127.0.0.1` 皆可；Authorized domains 只影響郵件動作連結（重設密碼／驗證信），本機測登入不需要。
- 本機跑 build 版（portal 慣用 :8000）若要用 AI，**後端 `ALLOWED_ORIGINS` 須含 `http://localhost:8000`**，否則 `Failed to fetch`（CORS）。線上正式域名不受影響。
- 雲端**即時同步是前端直連 Firebase，localhost 即可測**（與 AI/CORS 無關）：開兩個分頁、同一帳號登入，一邊改另一邊應自動更新。
- `.agents/skills/` 與 `.windsurf/workflows/` 是設計思考流程工具包（empathize/define/ideate/prototype/test），與應用程式碼無關。

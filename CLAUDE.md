# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**成長藍圖實作平台** — 商周百億 CEO 工作坊的線上實作平台。詳細的 API 規範、資料模型、ADR 決策記錄在 **`CLAUDE_CONTEXT.md`**（本檔的深度參考，動 API 或資料模型前先讀它）。

一個 repo 內含五個獨立部分，**各單元框架不同，指令互不通用**：

| 路徑 | 內容 | 框架 | 建置輸出 |
| --- | --- | --- | --- |
| repo 根（`index.html` + `css/ js/ data/ pages/`） | Portal 入口站 | 純靜態，Caddy 提供 | 無需建置 |
| `growthmap/opportunity-system/` | 識別機會（第三堂，**開發主力**） | CRA React + Tailwind | `build/`（**要 commit**） |
| `growthmap/aspiration-case/` | 願景 | Vite + React + zustand | `dist/`（要 commit） |
| `growthmap/momentum-case/` | 動能 | Next.js static export | `out/`（要 commit） |
| `growthmap/ido-ai-service/` | AI/BFF 後端 | Node + Hono + Anthropic SDK | 無建置，直接跑 `src/` |

## 常用指令

```bash
# opportunity-system（在 growthmap/opportunity-system/）
npm start                                    # dev server :3000
npm test                                     # Jest watch 模式（測試在 src/__tests__/）
npm test -- --watchAll=false                 # 跑一次就結束（CI 模式）
REACT_APP_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run build   # 正式建置（見下方「關鍵」）

# ido-ai-service（在 growthmap/ido-ai-service/）
npm run dev                                  # --watch + 讀 .env（需 ANTHROPIC_API_KEY）

# aspiration-case：npm run dev / npm run build / npm run lint（eslint）
# momentum-case：npm run dev / npm run build / npm run lint
# portal 本機預覽（repo 根）：python3 -m http.server 8000
```

## 部署（Zeabur，direct deploy 非 git 連動）

Zeabur 專案 `growth-map-main`（project-id `69a70ecee10515e35593d1c2`）有兩個服務；**push GitHub 不會觸發部署**，改完必須手動 deploy。重新部署**務必帶 `--service-id`**，否則會建出重複服務：

```bash
# 前端站（repo 根執行）— https://growth-map-main.zeabur.app
npx zeabur@latest deploy --project-id 69a70ecee10515e35593d1c2 --service-id 69e22e6fe3efc3fd3558607b
# 後端（在 growthmap/ido-ai-service 執行）— https://growthmap-ai.zeabur.app
npx zeabur@latest deploy --project-id 69a70ecee10515e35593d1c2 --service-id 6a2591b7f1be9943f1f9d17b
```

**改前端 `src` 後的完整流程（三步缺一不可）**：

1. 重 build，且**必須帶 `REACT_APP_AI_BASE_URL`**（CRA 是建置時注入；漏設則線上 AI 功能整組停用——GD-06 優雅降級，不會報錯，容易漏察覺）。
2. 重新部署前端服務（`.zeaburignore` 只打包 build 輸出，排除 `src/`）。
3. **commit `build/` 進 git**——本 repo 刻意把建置產物入版控，維持「GitHub = 線上」的同步慣例。

後端環境變數（`ANTHROPIC_API_KEY`、`ALLOWED_ORIGINS`、`REQUIRE_AUTH`、`FIREBASE_PROJECT_ID`、`MODEL_*`）存在 Zeabur，不在 git；完整清單見 CLAUDE_CONTEXT.md §3.5。

## 核心架構（跨檔案才看得懂的部分）

- **AI 人在迴路鐵則（ADR-004）**：ido-ai-service 只回 `state: "draft"` 建議稿，**後端不寫任何業務資料**；前端 `AiSuggestionCard` 使用者點採納後才寫入 state → Firestore。改任何 AI 流程都不得違反此原則。
- **opportunity-system 狀態流**：`OpportunityContext`（reducer）為唯一 state 來源 → localStorage（key `bw_opportunity_v2`）＋ Firestore `users/{uid}/apps/opportunity` 雙寫。Firestore `onSnapshot` 即時同步到其他裝置，防迴授靠三層（clientId、hasPendingWrites、內容簽章），衝突為 last-write-wins——改同步邏輯（`lib/cloud/sync.js`）前先讀 CLAUDE_CONTEXT.md §5.3。
- **資料模型**：`utils/schema.js`（`SCHEMA_VERSION = 2`）。migration 為**冪等純增量補欄位**，不刪舊欄位；新舊欄位並存是刻意的漸進切換設計，勿「順手清理」舊欄位。
- **CORS fail-closed**：後端未設 `ALLOWED_ORIGINS` = 拒絕所有跨來源（防止變成公開的 Anthropic proxy）。本機測 AI 要把 `http://localhost:8000` 加進後端的 `ALLOWED_ORIGINS`。
- **Firebase token 驗證是自行實作**（`firebase-auth.js`，Node crypto 驗 RS256），刻意不用 firebase-admin，勿引入該依賴。
- **已知 gotcha**：AI-03 的 `rationale` 與 AI-07 對話不持久化，PDF 匯出取不到。

## 本機開發注意

- Firebase Google 登入一律用 `localhost`，**不要 `127.0.0.1`**（否則 `auth/unauthorized-domain`）。
- 雲端即時同步是前端直連 Firebase，localhost 就能測：同帳號開兩分頁，一邊改另一邊約 1 秒自動更新。
- `.agents/skills/` 與 `.windsurf/workflows/` 是設計思考流程工具包（empathize/define/ideate/prototype/test），與應用程式碼無關。

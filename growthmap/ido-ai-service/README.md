# IDO AI/BFF 服務

識別機會模組（MOD-06）的輕量 AI 後端：代理 Anthropic Claude，落實**人在迴路**——只回 `draft` 建議，**不寫任何業務資料**；採納由前端使用者點擊後寫入 Firestore（ADR-004 / GD-04）。

## 端點

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/` | 健康檢查（回 `hasApiKey`）|
| POST | `/api/ai/tasks` | AI-01 洞察生成 / AI-03 模版三評分 / AI-04 排序 → 回 `{ state:'draft', payload, confidence }` |
| POST | `/api/ai/coach` | AI-07 教練對話（SSE 串流 `coach.delta` / `coach.done`）|

請求範例：
```
POST /api/ai/tasks
{ "taskCode": "AI-01", "input": { "toolName": "異常分析", "inputs": {...} } }
```

## 本地啟動

```bash
cp .env.example .env      # 填入 ANTHROPIC_API_KEY
npm install
node --env-file=.env src/index.js   # 或 npm run dev
```

## 部署（Vultr＋Coolify，2026-10-26 起）

1. 跑在 Coolify 專案 `growth-map-main` 的應用 `growthmap-ai`（Vultr 東京主機 `app2`；主控台 https://ops.wiwiapps.com ，只有管理者能登入），正式網址 https://growthmap-ai.wiwiapps.com ，容器埠 8787。**Base Directory** 是 `growthmap/ido-ai-service`，用該目錄的 `Dockerfile`；push `main` 自動部署，回退在應用頁 Deployments 挑前一次重新部署。（2026-10-26 前在 Zeabur，當時是同 repo 新增第二服務。）
2. 環境變數在 Coolify 應用頁的 Environment Variables 設定（值不進 git）：`ANTHROPIC_API_KEY`、`ALLOWED_ORIGINS`（填前端正式域名）、`REQUIRE_AUTH=true`、`MODEL_*`（可選）；完整清單見 repo 根 `CLAUDE.md`「後端環境變數」。Log 看應用頁的 Logs。
3. 前端 `opportunity-system` 設定 `VITE_AI_BASE_URL` 指向本服務網址（https://growthmap-ai.wiwiapps.com）。

## 安全

- key 僅存環境變數，**永不入 git**（`.env` 已被 `.gitignore` 排除）。
- 送 LLM 前去識別化（GD-07）；CORS 限制來源；AI 端點 rate limit 20/min。
- 正式環境 `REQUIRE_AUTH=true`；完整 Firebase ID token 簽章驗證為部署強化項（目前為 Bearer 存在性檢查）。
- 模型分工可由 `MODEL_OPUS/SONNET/HAIKU` 環境變數調整（ADR-009，不寫死）。

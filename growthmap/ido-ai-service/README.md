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

## Zeabur 部署（第二服務）

1. 同 repo 新增服務，**Root Directory** 設為 `growthmap/ido-ai-service`（Dockerfile 自動偵測）。
2. 環境變數設定：`ANTHROPIC_API_KEY`、`ALLOWED_ORIGINS`（填前端正式域名）、`REQUIRE_AUTH=true`、`MODEL_*`（可選）。
3. 前端 `opportunity-system` 設定 `REACT_APP_AI_BASE_URL` 指向本服務網址。

## 安全

- key 僅存環境變數，**永不入 git**（`.env` 已被 `.gitignore` 排除）。
- 送 LLM 前去識別化（GD-07）；CORS 限制來源；AI 端點 rate limit 20/min。
- 正式環境 `REQUIRE_AUTH=true`；完整 Firebase ID token 簽章驗證為部署強化項（目前為 Bearer 存在性檢查）。
- 模型分工可由 `MODEL_OPUS/SONNET/HAIKU` 環境變數調整（ADR-009，不寫死）。

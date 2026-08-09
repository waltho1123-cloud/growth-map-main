# 識別機會模組 — SDD 整合計劃

> 將《成長藍圖平台 — 識別機會模組 SDD v1.0》整合進現有 `opportunity-system`。
> 本文件為執行依據；遵循 SDD 精神（規格驅動），但技術棧依現實做務實對應。

## 一、架構決策（已與使用者確認）

| 決策 | 選擇 | 說明 |
| --- | --- | --- |
| 架構路線 | **混合：前端 + 輕量 AI/BFF 後端** | 主體沿用現有 CRA + Firestore 靜態架構；另開一個輕量後端服務承載 AI 與整合 |
| 首批範圍 | **完整（含 AI 人在迴路）** | MOD-01/02/03/05/06/08 全做；MOD-07 團隊協作延後 |

**核心取捨**：SDD 原設計為全棧（Next.js+FastAPI+PostgreSQL+Prisma+worker）。本整合**保留 SDD 的業務規格**（資料模型、三模版、綜合檢查、狀態機、人在迴路），但**技術實作換軌**：以 Firestore 取代 PostgreSQL、以輕量 Node BFF 取代 FastAPI worker，維持與前兩堂一致的「靜態 SPA + Firestore」部署模式。

## 二、目標架構

```
Portal (靜態) ── unit-3 opportunity-system (CRA SPA, 擴充)
                        │  前端直接讀寫 Firestore：
                        │   users/{uid}/apps/opportunity  ← 機會/工具分析/檢查/專案meta
                        │   users/{uid}/apps/aspiration    ← 讀第二堂(差距/營收拆解, 唯讀)
                        │
                        │  AI 任務 / 教練對話 經由 ↓
                        ▼
                IDO AI/BFF 服務 (Zeabur 第二服務, Node + Hono)
                ├─ POST /api/ai/tasks  (AI-01 洞察 / AI-03 評分 / AI-04 排序) → draft 建議
                ├─ POST /api/ai/coach  (AI-07 教練, SSE 串流)
                ├─ Firebase ID token 驗證 + 去識別化 + prompt 注入防護
                └─ Claude API 代理 (key 僅存伺服器端)
```

**人在迴路鐵則（ADR-004 / GD-04）**：後端只回「建議稿」，**不寫 Firestore**；前端顯示 draft，使用者 accept 後才套用並寫入。AI 永不自動拍板。

## 三、資料模型（Firestore 文件擴充，對照 SDD §2.5 ERD）

現有 `users/{uid}/apps/opportunity` 的 `data` 由 `{ opportunities: [] }` 擴充為：

```js
data: {
  schemaVersion: 2,                    // 用於 migration 判斷
  opportunities: [ Opportunity ],      // 機會（擴充，見下）
  projectMeta: {                       // 新增（MOD-01/08）
    bufferRatio: 1.2,                  // CHK-1 緩衝係數（ADR-010, 可調）
    toolActivation: { [code]: bool },  // 工具啟用（MOD-02, 預設 17-24=true）
    targetSnapshot: { aspiration, momentum, growthGap, currency, syncedAt },
    archetypeSnapshot: { archetype, recommendedModes, syncedAt },
  },
  toolAnalyses: {                      // 新增（MOD-02）
    [toolCode]: { inputs:{}, insights:[], opportunitiesNote:[], status, updatedAt }
  },
  lastCheckRun: { overallStatus, results:[], ranAt },  // 新增（MOD-05）
}

// Opportunity（對照 OpportunityDTO，ADR-008 單一實體承載三模版）
Opportunity = {
  id, opportunityName,
  status: 'draft'|'insight_linked'|'evaluated'|'shortlisted'|'handed_off'|'archived',  // 新增
  estRevenue: number, currency: 'TWD',   // 新增（CHK-1 必需）
  usedTools: number[],                   // = sourceToolCodes（M:N）
  template1: { companyType, growthDimension, growthLever, growthType[], insights },
  template2: {                           // 擴充七面向
    concept, method,
    targetCustomer, usp,                 // 相容保留；新增結構化在下
    goToMarket: { rnd, production, pricing, marketing, channel, logistics, afterSales },
    steps,
  },
  template3: {                           // 擴充四象限 1-5 評分
    size: { marketSize, unitPrice, competitiveEnvironment, topBrandsShare, rating },
    potential: { currentScale, cagr, ebitMargin, points, rating },
    path: { requiredInvestment, potentialHurdles, rating },
    rightToWin: { successFactors, coreCapabilities, rating },
    ebitBand, cagrBand,
  },
  aiScore: number, rank: number,         // 新增（AI-04 排序）
}
```

**向後相容 migration**（`schemaVersion < 2` → 2）：補 status='draft'、estRevenue=0；模版二舊字串欄位保留並包進新結構；模版三舊散裝欄位映射到四象限、rating 預設 0（未評）。**不刪任何既有資料**。

## 四、MOD-08 平台整合（前端化方案）

第二堂 `aspiration-case` 的 Firestore（`users/{uid}/apps/aspiration`，store `bw-growth-map-aspiration`）已含：
- `companyInfo.naturalGrowth.targetRevenue2028` → **Momentum**（自然增長）
- `companyInfo.aspirationGrowth.targetRevenue2028` → **Aspiration**（加速增長）
- `partA[]`（既有/新產品/新市場/新商模 的 2028 營收）→ **revenue-breakdown**

→ 差距儀表 `growthGap = aspiration − momentum`，**純前端讀取，不需 M2 API**。
→ `archetype`（堡壘/流動/衰退）第二堂未存，暫由第三堂手動選（沿用現有 TabOne companyType），標 `[待確認]` 是否回前兩堂補存。
→ 對 M4 輸出：以 JSON 快照交付（前端產出 + 凍結），無跨服務事件匯流排。

## 五、分階段執行（Task #1–#7）

| Phase | 內容 | 需 key | 對應 SDD |
| --- | --- | --- | --- |
| 0 | 資料模型 + migration + 工具 seed + 專案 meta | — | §2.5, ADR-007/008 |
| 1 | MOD-02 工具庫 + 工具分析頁 + SPA 導航 | — | FR-02-*, §4.2/4.7 |
| 2 | MOD-03 三模版完整化（七面向 / 四象限評分 / estRevenue） | — | FR-03-* |
| 3 | MOD-01/08 差距儀表 + 機會狀態機 | — | FR-01-*, FR-08-01, §4.1 |
| 4 | MOD-05 綜合檢查 CHK-1~5 + 排序 | — | FR-05-*, §4.3/4.4 |
| 5 | MOD-06 AI 協作後端 + 前端人在迴路 | **是** | MOD-06, §4.5 |
| 6 | MOD-08 交付輸出/快照 + build/部署收尾 | — | FR-04-04/05, GD-09 |

Phase 0–4、6 不需 Claude API key，可先完成。Phase 5 需使用者提供 key。

## 六、AI 後端設計（Phase 5）

- **技術**：Node + Hono + `@anthropic-ai/sdk`（與前端 JS 生態一致；Claude 官方 SDK）。
- **模型分工（ADR-009，設定檔不寫死）**：教練/排序=Opus 級；洞察/模版三評分=Sonnet 級；去識別化前處理=Haiku 級。
- **端點**：`POST /api/ai/tasks`（回 draft 建議 + confidence）、`POST /api/ai/coach`（SSE）。
- **安全（GD-07）**：Firebase ID token 驗證；送 LLM 前去識別化（僅統計特徵，不傳客戶 PII/逐筆營收）；使用者輸入標註為「資料非指令」防注入；輸出不觸發任何副作用。
- **降級（GD-06）**：供應商故障→前端切手動模式，核心表單仍可用。
- **部署**：Zeabur 第二服務；前端以環境變數設定 API base URL。

## 七、待使用者提供

1. **Claude API key**（Phase 5）：可用自有 Anthropic key，或 **Zeabur AI Hub**（OpenAI/Anthropic 相容，已在 Zeabur 生態內）。
2. `archetype` 是否回前兩堂補存（否則第三堂手動選）。

## 八、Guard Rules 對齊

GD-02 鎖技術棧（不引入 PostgreSQL/Redis）；GD-04 AI 皆 draft 經人類 accept；GD-05 不用 Redis；GD-06 AI 故障降級；GD-07 去識別化+防注入；GD-08 工具/選單/權重/緩衝係數為資料驅動；GD-09 已交付快照不可變、續編產生新版。

## 九、工作流注意

- 改 `src/` 後須 `npm run build`（產 `build/`）；`.zeaburignore` 排除 `src/`，Caddy 只服務 `build/`。
- React 19 + Vite 8（2026-08 自 CRA 遷移）：`npm install` 直接可用，不再需要 `--legacy-peer-deps`。

## 十、進度

- [x] **Phase 0** 資料模型與相容層（schema / toolLibrary / migration / context）
- [x] **Phase 1** MOD-02 工具庫 + 工具分析頁（NavContext / DynamicField / ToolLibrary / ToolAnalysis）
- [x] **Phase 2** MOD-03 三模版完整化（TabTwo 七面向、TabThree 四象限評分 + estRevenue）
- [x] **Phase 3** MOD-01/08 差距儀表 + 機會狀態機（orient / opportunityStatus / GrowthGapDashboard）
- [x] **Phase 4** MOD-05 綜合檢查 CHK-1~5 + 排序（checkEngine / CheckPanel）
- [ ] **Phase 5** MOD-06 AI 協作後端 + 人在迴路 — **需 Claude API key / Zeabur AI Hub**
- [x] **Phase 6** MOD-08 交付輸出（JSON）+ 不可變快照（HandoffPanel / handoff，GD-09）
- [x] **Phase 5** MOD-06 AI 協作 — 後端服務 + 前端 AI-01/03/04/07 + 人在迴路 **程式碼完成**；僅 Zeabur 部署待做

### Phase 5 細節
- 後端 `growthmap/ido-ai-service`（Node + Hono + `@anthropic-ai/sdk`）：`/api/ai/tasks`（AI-01/03/04）、`/api/ai/coach`（AI-07 SSE）。去識別化、CORS、rate limit、人在迴路（只回 draft）。已用真實 key 驗證 AI-01 通過（`claude-sonnet-4-6`）。
- 前端：`lib/ai/aiClient.js`、`components/ai/AiSuggestionCard.js`（accept/reject）、`CoachDrawer.js`；工具分析「AI 產洞察」、模版三「AI 評分」、右下教練浮動鈕。`VITE_AI_BASE_URL` 未設時 AI 停用（降級 GD-06）。
- AI-04 排序：已完成（`components/ai/AiRankPanel.js`，採納寫入機會 `rank`，長清單優先依 rank 排序）。
- **待辦**：本地端到端測試（`VITE_AI_BASE_URL=http://localhost:8787 npm start` + 後端 `node --env-file=.env src/index.js`）；Zeabur 第二服務部署。
- **⚠️ key 安全**：使用者曾將 key 貼於對話，需撤銷換新；正式環境用 Zeabur 環境變數。

Phase 0–4、6 全綠 + **17/17 整合測試通過**（2026-08-09，Vite 8 遷移後）。`build/` 已 commit 進 repo（「GitHub = 線上」慣例）。AI 在無 `VITE_AI_BASE_URL` 的 build 中停用（GD-06）。


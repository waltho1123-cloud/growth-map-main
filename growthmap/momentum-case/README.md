# 動能（Momentum Case）

商周成長藍圖工作坊第一堂的實作單元：營收拆解樹 × 瀑布圖視覺化。**Vite 8 + React 19 + TypeScript**，echarts 圖表（2026-08 自 Next.js static export 遷移）。

## 指令

```bash
npm run dev        # Vite dev server（http://localhost:5173，host 0.0.0.0 可 LAN 連入）
npm run build      # 三重 gate：tsc --noEmit → eslint → vite build（輸出 out/）
npm run lint       # eslint（ts-eslint + react + 經典 hooks 規則）
npm run preview    # 本機預覽 out/ 產物
```

## 關鍵事實

- **單頁應用**：無路由；`src/App.tsx` lazy 載入 `WizardShell`（六步精靈）。
- 建置輸出 `out/` **要 commit 進 git**（「GitHub = 線上」慣例），線上掛 `/growthmap/momentum-case/out/`（`base: './'` 相對路徑）。
- 雲端同步走 `@growthmap/cloud`（onSnapshot 即時同步＋防迴授四層）；appKey 與資料契約走 `@growthmap/contracts`。
- PDF 匯出走 `@growthmap/pdf`（`orientation: 'auto'`、含 placeholder）。
- 部署切換恢復：`src/main.tsx` 的 `installChunkReloadRecovery`（本地為 zustand persist 同步寫入，只需 flush 時間戳）。

架構、跨單元資料流、部署細節：見 repo 根 `CLAUDE.md`。

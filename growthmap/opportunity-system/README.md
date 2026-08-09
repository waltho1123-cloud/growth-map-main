# 識別機會（Opportunity System）

商周成長藍圖工作坊第三堂的實作單元。**Vite 8 + React 19 + Tailwind**，測試用 **Vitest**（2026-08 自 CRA 遷移）。

## 指令

```bash
npm start          # Vite dev server（http://localhost:5173）
npm test           # Vitest watch；跑一次用 npm test -- run
npm run lint       # eslint（react + react-hooks 經典規則）
VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run build   # 正式建置（漏設則 AI 功能停用）
npm run preview    # 本機預覽 build 產物
```

## 關鍵事實

- **Node >= 22.22**（`engines`；jsdom 30 與 Vite 8 的地板）。
- **瀏覽器支援下限明訂於 `vite.config.mjs` 的 `build.target`**（chrome87 / edge88 / firefox78 / safari14），刻意不用 Vite 8 預設的 Baseline 2026。`browserslist` 僅供 autoprefixer 決定 CSS 前綴。
- 建置輸出 `build/` **要 commit 進 git**（「GitHub = 線上」慣例），部署是手動 Zeabur direct deploy。
- 部署切換時舊分頁的 lazy chunk 404 由 `src/index.jsx` 的 `vite:preloadError` 監聽自動整頁重載（60 秒防迴圈）。
- PDF 中文字型走 asset import（`src/assets/NotoSansTC.ttf`），不要改回手拼 URL。

架構、資料模型、AI 任務、跨單元資料流、部署細節：見 repo 根 `CLAUDE.md`。

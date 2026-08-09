# 識別機會（Opportunity System）

商周成長藍圖工作坊第三堂的實作單元。**Vite 8 + React 19 + Tailwind**，測試用 **Vitest**（2026-08 自 CRA 遷移）。

## 指令

```bash
npm start          # Vite dev server（http://localhost:5173）
npm test           # Vitest watch；跑一次用 npm test -- run
npm run lint       # eslint（react + react-hooks 經典規則）
VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run build   # 正式建置（先跑 eslint gate；漏設變數則 AI 功能停用）
npm run preview    # 本機預覽 build 產物
```

## 關鍵事實

- **Node `^22.22.2 || ^24.15.0 || >=26`**（`engines`，對齊 jsdom 30 的支援線）。
- **瀏覽器支援下限明訂於 `vite.config.mjs` 的 `build.target`**（chrome87 / edge88 / firefox78 / safari14），刻意不用 Vite 8 預設的 Baseline 2026。`browserslist` 僅供 autoprefixer 決定 CSS 前綴。
- 建置輸出 `build/` **要 commit 進 git**（「GitHub = 線上」慣例），部署是手動 Zeabur direct deploy。
- 部署切換時舊分頁的 lazy chunk 404 由 `src/index.jsx` 的 `vite:preloadError` 處理：先觸發 `bw:flush-save` 同步存檔（防 debounce 競態掉編輯）再重載，60 秒內限一次；再失敗由 `AppErrorBoundary` 顯示可重載的錯誤畫面。
- PDF 中文字型走 `public/fonts/NotoSansTC.ttf` 的**穩定路徑**（刻意不用 hashed asset）——部署切換後舊分頁載的是舊 URL，穩定路徑保證新舊版本都抓得到；勿改成 hashed import。
- dev server 綁 `0.0.0.0`（`server.host: true`）：跨裝置即時同步可用手機連 LAN IP 測。

架構、資料模型、AI 任務、跨單元資料流、部署細節：見 repo 根 `CLAUDE.md`。

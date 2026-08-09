import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' 使產物可掛在任意子路徑（線上為 /growthmap/opportunity-system/build/）
// build.target 明訂瀏覽器支援下限（審查裁定：不用 Vite 8 預設的 Baseline 2026，
// 維持 Vite 傳統 'modules' 等級，涵蓋較舊的企業環境瀏覽器）
export default defineConfig({
  plugins: [react()],
  base: './',
  // host: true 恢復 CRA 時代綁 0.0.0.0 的行為——跨裝置即時同步要用手機連 LAN IP 測試
  server: { host: true },
  preview: { host: true },
  build: {
    outDir: 'build',
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
  test: { environment: 'jsdom', globals: true },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' 使產物可掛在任意子路徑（線上為 /growthmap/opportunity-system/build/）
// build.target 明訂瀏覽器支援下限（審查裁定：不用 Vite 8 預設的 Baseline 2026，
// 維持 Vite 傳統 'modules' 等級，涵蓋較舊的企業環境瀏覽器）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
  test: { environment: 'jsdom', globals: true },
});

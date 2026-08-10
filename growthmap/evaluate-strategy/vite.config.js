import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' 使產物可掛在任意子路徑（線上為 /growthmap/evaluate-strategy/dist/）
// build.target 與 opportunity-system 同一裁定：維持 'modules' 等級的明確清單，
// 涵蓋較舊的企業環境瀏覽器（勿回退到 Vite 8 預設 Baseline）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { host: true },
  preview: { host: true },
  build: {
    outDir: 'dist',
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
  test: { environment: 'node' },
});

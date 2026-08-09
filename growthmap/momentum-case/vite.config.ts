import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' 使產物可掛在任意子路徑（線上為 /growthmap/momentum-case/out/，
// 取代 Next 時代的 basePath）；outDir 'out' 維持既有部署路徑不變。
// build.target 與 opportunity-system 同一裁定（企業瀏覽器下限）。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { host: true },
  preview: { host: true },
  build: {
    outDir: 'out',
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
});

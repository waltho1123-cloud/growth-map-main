import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' 使產物可掛在任意子路徑（線上為 /growthmap/opportunity-system/build/）
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'build' },
  test: { environment: 'jsdom', globals: true },
});

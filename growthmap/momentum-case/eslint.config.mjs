import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// 2026-08 自 eslint-config-next 遷出（Phase 3：Next → Vite）。
export default tseslint.config(
  { ignores: ['out/', 'node_modules/', '.next/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // hooks 只開經典兩條；compiler 級規則（refs/immutability）會打中 TreeView
      // 刻意的 latest-ref／遞迴 useCallback 模式（與 opportunity-system 同一裁定）
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off', // Vite 自動 JSX runtime
      'react/prop-types': 'off', // TS 已涵蓋 props 型別
    },
  },
);

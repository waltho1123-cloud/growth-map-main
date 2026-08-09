import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['build/', 'node_modules/'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // hooks 只開經典兩條；v7 的 compiler 級規則（purity/refs）會打中
      // OpportunityContext 刻意的 latest-state-ref 同步模式，留待重構時再評估
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off', // Vite 自動 JSX runtime
      'react/prop-types': 'off', // 本專案不用 PropTypes
      // 全形空白允許出現在 JSX 顯示文字（中文排版），仍禁止混入程式碼
      'no-irregular-whitespace': ['error', { skipJSXText: true }],
    },
  },
  {
    files: ['src/__tests__/**'],
    languageOptions: { globals: { ...globals.vitest } },
  },
];

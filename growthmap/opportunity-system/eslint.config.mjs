import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import confusingBrowserGlobals from 'confusing-browser-globals';

export default [
  { ignores: ['build/', 'node_modules/'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
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
      // 補回舊 react-app preset 的除錯規則（CRA 建置期原本會擋下這些缺陷類型）
      'array-callback-return': 'error',
      'no-restricted-globals': ['error', ...confusingBrowserGlobals],
      'eqeqeq': ['error', 'smart'],
      'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      // jsx-a11y 維持 react-app 的 warn 等級：可見但不擋 build gate
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([k, v]) => {
          if (v === 'error' || v === 2) return [k, 'warn'];
          if (Array.isArray(v) && (v[0] === 'error' || v[0] === 2)) return [k, ['warn', ...v.slice(1)]];
          return [k, v];
        })
      ),
    },
  },
  {
    files: ['src/__tests__/**'],
    languageOptions: { globals: { ...globals.vitest } },
  },
];

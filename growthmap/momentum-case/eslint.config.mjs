import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks v7 的 compiler 級規則會打中 TreeView 刻意的
      // latest-ref／遞迴 useCallback 模式（與 opportunity-system 同一裁定：
      // 經典 rules-of-hooks/exhaustive-deps 照舊生效，compiler 級留待重構時評估）
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;

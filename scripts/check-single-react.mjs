// 防復發檢查：workspace 內只允許 root 一份實體 react/react-dom。
// 任何單元/包被 npm 巢狀塞入第二份（通常因為某處把版本釘死、與 hoist 版本衝突），
// 會造成同 app 兩個 React 實例 → invalid hook call 白屏（2026-08-09 momentum 事故）。
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['growthmap', 'packages'];
const offenders = [];
for (const base of roots) {
  if (!existsSync(base)) continue;
  for (const unit of readdirSync(base)) {
    for (const pkg of ['react', 'react-dom']) {
      const p = join(base, unit, 'node_modules', pkg);
      if (existsSync(p)) offenders.push(p);
    }
  }
}
if (offenders.length) {
  console.error('❌ 偵測到巢狀 React 副本（會造成兩個 React 實例白屏）：');
  for (const p of offenders) console.error('   ' + p);
  console.error('   修法：把該單元 package.json 的 react/react-dom 改成與其他單元相容的 caret 範圍後重新 npm install。');
  process.exit(1);
}
console.log('✓ React 單一實體副本（無巢狀）');

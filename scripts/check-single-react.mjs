// 防復發檢查：整個 workspace 只允許 root node_modules 一份實體 react/react-dom。
// 任何深度的巢狀副本（通常因為某處釘死版本、與 hoist 版本衝突）都會造成
// 同 app 兩個 React 實例 → invalid hook call 白屏（2026-08-09 momentum 事故）。
//
// 設計要點（回應 max 審查 findings）：
// 1. 以本腳本位置錨定 repo 根——從任何 cwd 執行結果一致，不會假綠。
// 2. 遞迴走訪「所有」node_modules（含巢狀），不只掃第一層。
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGETS = new Set(['react', 'react-dom']);
const allowed = new Set();
for (const t of TARGETS) allowed.add(join(REPO_ROOT, 'node_modules', t));

const offenders = [];

function scanNodeModules(nmDir, depth) {
  if (depth > 12) return;
  let entries;
  try { entries = readdirSync(nmDir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const full = join(nmDir, e.name);
    if (e.name.startsWith('.')) continue;
    if (e.name.startsWith('@')) {
      // scope 目錄：往下一層找套件
      let scoped;
      try { scoped = readdirSync(full, { withFileTypes: true }); } catch { continue; }
      for (const s of scoped) {
        const pkgDir = join(full, s.name);
        descendIntoPackage(pkgDir, depth);
      }
      continue;
    }
    if (TARGETS.has(e.name) && existsSync(join(full, 'package.json')) && !allowed.has(full)) {
      offenders.push(relative(REPO_ROOT, full));
    }
    descendIntoPackage(full, depth);
  }
}

function descendIntoPackage(pkgDir, depth) {
  const nested = join(pkgDir, 'node_modules');
  try {
    if (statSync(nested).isDirectory()) scanNodeModules(nested, depth + 1);
  } catch { /* 無巢狀 */ }
}

// root node_modules（含其內任意深度的巢狀）
scanNodeModules(join(REPO_ROOT, 'node_modules'), 0);
// 各 workspace 目錄下可能被 npm 直接放置的巢狀 node_modules
for (const base of ['growthmap', 'packages']) {
  const baseDir = join(REPO_ROOT, base);
  if (!existsSync(baseDir)) continue;
  for (const unit of readdirSync(baseDir)) {
    scanNodeModules(join(baseDir, unit, 'node_modules'), 0);
  }
}

if (offenders.length) {
  console.error('❌ 偵測到 root 之外的實體 React 副本（會造成兩個 React 實例白屏）：');
  for (const p of offenders) console.error('   ' + p);
  console.error('   修法：找出釘死版本的宣告（npm explain react），改為與 hoist 版相容的範圍後重新 npm install。');
  process.exit(1);
}
console.log('✓ React 單一實體副本（root 之外任何深度皆無巢狀）');

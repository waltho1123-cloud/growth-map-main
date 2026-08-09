// preflight 前置：部署用建置必須帶 VITE_AI_BASE_URL。
// 沒帶時 vite build 照樣全綠，但產物的 AI 功能整組靜默停用（GD-06 優雅降級）——
// 曾是 CLAUDE.md 點名「容易漏察覺」的陷阱，gate 不得替它蓋綠燈。
if (!process.env.VITE_AI_BASE_URL) {
  console.error('❌ 未設定 VITE_AI_BASE_URL——建置產物會把 AI 功能整組靜默停用。');
  console.error('   部署用 preflight 請執行：VITE_AI_BASE_URL=https://growthmap-ai.zeabur.app npm run preflight');
  process.exit(1);
}
console.log(`✓ VITE_AI_BASE_URL = ${process.env.VITE_AI_BASE_URL}`);

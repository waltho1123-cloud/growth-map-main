// AI/BFF 服務設定（ADR-009：model 字串等全部環境變數可配置）
export const config = {
  port: Number(process.env.PORT) || 8787,
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  },
  // 模型分工（SDD §4.5.1）
  models: {
    opus: process.env.MODEL_OPUS || 'claude-opus-5', // 教練 / 機會發想 / 檢查建議
    sonnet: process.env.MODEL_SONNET || 'claude-sonnet-5', // 洞察生成 / 模版三評分 / 排序
    haiku: process.env.MODEL_HAIKU || 'claude-haiku-4-5', // 去識別化前處理（預留）
  },
  // 預設 fail-closed：未設定 ALLOWED_ORIGINS 時不允許任何跨來源，
  // 避免部署時忘了設定就變成對外全開的付費 Anthropic proxy。要全開需顯式設 '*'。
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  requireAuth: process.env.REQUIRE_AUTH === 'true',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
};

export const hasApiKey = () => Boolean(config.anthropic.apiKey);

import { useEmailLogin } from '../../lib/cloud/auth';
import { isFirebaseConfigured } from '../../lib/cloud/firebase-config';

// 多人協作單元：一律需要登入（與單元一～三「未登入可離線用」不同——
// 共享專案沒有本地後援語意）。
// 錯誤文字（帳號不存在／密碼錯誤／網域未授權……）已由 useEmailLogin 統一翻譯成繁中，
// 這裡只負責顯示。
export default function LoginGate() {
  const { email, setEmail, password, setPassword, busy, error, notice, submit } = useEmailLogin();

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">
          Firebase 尚未設定（@growthmap/firebase 的 config 為占位值），評估策略工作台無法啟用。
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
      <a href="/" className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800">
        <span>←</span>
        <span>返回藍圖</span>
      </a>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
        </h1>
        <p className="mt-1 text-sm text-slate-500">評估策略 (Evaluate)</p>
        <h2 className="mt-4 text-lg font-bold text-slate-900">評估策略工作台</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          從 7–10 個機會長清單，收斂出 1–3 個帶高階商業計劃、疊加後可達成加速增長目標的策略方案。
          這是多人協作單元，請先登入。
        </p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3"
        >
          <label className="block text-left text-sm text-slate-700">
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-left text-sm text-slate-700">
            密碼
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {busy ? '登入中…' : '登入'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">忘記密碼請聯絡平台管理員</p>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
              {notice}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

import { signInWithGoogle } from '../../lib/cloud/auth';
import { isFirebaseConfigured } from '../../lib/cloud/firebase-config';

// 多人協作單元：一律需要登入（與單元一～三「未登入可離線用」不同——
// 共享專案沒有本地後援語意）。
export default function LoginGate() {
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
      <div className="text-center">
        <div className="mb-1 text-xs font-semibold tracking-widest text-indigo-600">GROWTH BLUEPRINT · 第四堂</div>
        <h1 className="text-2xl font-bold text-slate-900">評估策略工作台</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          從 7–10 個機會長清單，收斂出 1–3 個帶高階商業計劃、疊加後可達成加速增長目標的策略方案。
          這是多人協作單元，請先登入。
        </p>
      </div>
      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700"
      >
        使用 Google 帳號登入
      </button>
    </div>
  );
}

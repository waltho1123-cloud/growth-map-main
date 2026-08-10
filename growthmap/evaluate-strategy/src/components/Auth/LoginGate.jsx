import { useState } from 'react';
import { signInWithGoogle } from '../../lib/cloud/auth';
import { isFirebaseConfigured } from '../../lib/cloud/firebase-config';

// 多人協作單元：一律需要登入（與單元一～三「未登入可離線用」不同——
// 共享專案沒有本地後援語意）。
// 登入失敗一律顯示錯誤碼（popup 被擋／網域未授權／第三方儲存被封都曾以「靜默沒反應」呈現）。
export default function LoginGate() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">
          Firebase 尚未設定（@growthmap/firebase 的 config 為占位值），評估策略工作台無法啟用。
        </div>
      </div>
    );
  }

  const login = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
      // 成功後 useAuth 的 onAuthStateChanged 會讓 App 自動切換頁面
    } catch (e) {
      const code = e?.code || '';
      const hint = code === 'auth/popup-blocked' ? '瀏覽器擋下了登入彈窗，請允許本站的彈出式視窗後重試。'
        : code === 'auth/unauthorized-domain' ? '此網域未列入 Firebase 授權清單（Authentication → Settings → Authorized domains）。'
        : code === 'auth/popup-closed-by-user' ? '登入彈窗在完成前被關閉，請再試一次。'
        : code === 'auth/network-request-failed' ? '網路請求失敗，請檢查連線後重試。'
        : '';
      setError(`登入失敗：${code || e?.message || e}${hint ? `——${hint}` : ''}`);
    } finally {
      setBusy(false);
    }
  };

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
      <button
        type="button"
        disabled={busy}
        onClick={login}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:bg-slate-300"
      >
        {busy ? '登入中…' : '使用 Google 帳號登入'}
      </button>
      {error && (
        <p className="max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs leading-relaxed text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

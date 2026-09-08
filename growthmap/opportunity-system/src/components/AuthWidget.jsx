import React, { useState } from 'react';
import { useAuth, useEmailLogin, useEmailVerification, signOut } from '../lib/cloud/auth';
import { isFirebaseConfigured } from '../lib/cloud/firebase-config';

export function AuthWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const { email, setEmail, password, setPassword, busy, error, notice, submit } = useEmailLogin();
  const verification = useEmailVerification();

  if (!isFirebaseConfigured) return null;
  if (loading) return null;

  if (!user) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-gray-200 text-sm text-gray-700 hover:bg-white shadow-sm transition disabled:opacity-50"
        >
          登入
        </button>
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="absolute right-0 mt-1 w-72 bg-white rounded-lg border border-gray-200 shadow-lg p-3 text-sm"
          >
            <label className="mb-2 block text-xs font-medium text-gray-600">
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="mb-2 block text-xs font-medium text-gray-600">
              密碼
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? '登入中…' : '登入'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">忘記密碼請聯絡平台管理員</p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            {notice && <p className="mt-2 text-xs text-emerald-600">{notice}</p>}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/80 backdrop-blur border border-gray-200 shadow-sm hover:bg-white transition"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-semibold">
            {(user.displayName && user.displayName[0]) || (user.email && user.email[0]) || '?'}
          </span>
        )}
        <span className="text-xs text-emerald-700 font-medium">☁ 已同步</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden text-sm">
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-gray-900 font-medium truncate">{user.displayName || user.email}</div>
            <div className="text-gray-500 text-xs truncate">{user.email}</div>
          </div>
          {!user.emailVerified && (
            <div className="px-3 py-2 border-b border-gray-100 bg-amber-50 text-amber-800 text-xs">
              <p>email 尚未驗證——AI 功能與邀請需先完成驗證。</p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={verification.send}
                  disabled={verification.busy}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  寄送驗證信
                </button>
                <button
                  type="button"
                  onClick={verification.recheck}
                  disabled={verification.busy}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  我已驗證
                </button>
              </div>
              {verification.message && <p className="mt-1.5">{verification.message}</p>}
            </div>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}

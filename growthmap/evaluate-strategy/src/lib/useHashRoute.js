// 極簡 hash 路由：'#/scoring' → { path: 'scoring', parts: ['scoring'] }。
// 單頁工作台不需要 react-router；base './' 下 hash 路由對子路徑部署最穩。

import { useSyncExternalStore } from 'react';

function readHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  return raw || 'dashboard';
}

let cached = { raw: null, value: null };

function getSnapshot() {
  const raw = readHash();
  if (cached.raw !== raw) {
    const parts = raw.split('/').filter(Boolean);
    cached = { raw, value: { raw, path: parts[0] || 'dashboard', parts } };
  }
  return cached.value;
}

function subscribe(cb) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function navigate(path) {
  window.location.hash = path.startsWith('/') ? `#${path}` : `#/${path}`;
}

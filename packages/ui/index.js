// @growthmap/ui — 跨單元共用的全域錯誤邊界。
// 接住 render 與 lazy-chunk 載入失敗（含部署切換後自動重載仍失敗的情況），
// 以可操作的畫面取代整頁白屏。刻意用 React.createElement（非 JSX）撰寫：
// 共用包不經各單元的 JSX transform，純 JS 在任何單元（含 TS）都直接可用。
// 樣式內聯：邊界觸發時不可依賴任何外部 chunk。

import React from 'react';

const h = React.createElement;

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    // hasError 獨立於 error 值：throw null/undefined/0 等 falsy 值也必須觸發 fallback
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // 部分單元的 loading 遮罩是 #root 外的 fixed 覆蓋層（由主畫面掛載時移除）——
    // 錯誤發生時主畫面掛不上來，遮罩會蓋住本 fallback；在此顯式清除。
    for (const id of this.props.clearOverlayIds || []) {
      try { document.getElementById(id)?.remove(); } catch { /* 清不掉也不影響 fallback 邏輯 */ }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const subtitle = this.props.subtitle
      || '可能剛完成版本更新，或網路暫時不穩；重新載入即可回到最新狀態。';
    return h('div', {
      style: {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#eef1f5', fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    },
      h('div', {
        style: {
          background: '#fff', borderRadius: 16, padding: '32px 40px', maxWidth: 420,
          textAlign: 'center', boxShadow: '0 4px 24px rgba(16,42,67,.08)',
        },
      },
        h('div', { style: { fontSize: '1.125rem', fontWeight: 700, color: '#102A43', marginBottom: 8 } }, '頁面載入失敗'),
        h('div', { style: { color: '#486581', fontSize: '.875rem', lineHeight: 1.6, marginBottom: 20 } }, subtitle),
        h('button', {
          type: 'button',
          onClick: () => window.location.reload(),
          style: {
            background: '#00A651', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: '.9rem', fontWeight: 600, cursor: 'pointer',
          },
        }, '重新載入')
      )
    );
  }
}

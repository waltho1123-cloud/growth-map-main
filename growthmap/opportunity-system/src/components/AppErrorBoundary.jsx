import React from 'react';

// 全域錯誤邊界：接住 render 與 lazy-chunk 載入失敗（含部署切換後自動重載仍失敗的情況），
// 以可操作的畫面取代整頁白屏。樣式內聯：邊界觸發時不可依賴任何外部 chunk。
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 40px', maxWidth: 420, textAlign: 'center', boxShadow: '0 4px 24px rgba(16,42,67,.08)' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#102A43', marginBottom: 8 }}>頁面載入失敗</div>
          <div style={{ color: '#486581', fontSize: '.875rem', lineHeight: 1.6, marginBottom: 20 }}>
            可能剛完成版本更新，或網路暫時不穩；重新載入即可回到最新狀態。
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: '#00A651', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: '.9rem', fontWeight: 600, cursor: 'pointer' }}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }
}

import React, { useState } from 'react';
import { useOpportunity } from '../../contexts/OpportunityContext';
import { useAuth } from '../../lib/cloud/auth';
import { loadOrientSnapshot } from '../../lib/cloud/orient';
import { isFirebaseConfigured } from '../../lib/cloud/firebase-config';
import toast from 'react-hot-toast';

function fmt(n) {
  return new Intl.NumberFormat('zh-TW').format(Math.round(Number(n) || 0));
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default function GrowthGapDashboard() {
  const { state, dispatch } = useOpportunity();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const snap = state.projectMeta.targetSnapshot;

  const handleSync = async () => {
    if (!isFirebaseConfigured || !user) {
      toast.error('請先登入以同步第二堂（加速增長情境）資料');
      return;
    }
    setSyncing(true);
    try {
      const orient = await loadOrientSnapshot(user.uid);
      if (!orient) {
        toast.error('找不到第二堂資料，請先於「加速增長情境」填寫並登入同步');
        return;
      }
      if (orient.contractOk === false) {
        // 契約違約：數值不可信，停止套用（prod 不靜默——詳細缺欄已由契約包 console.error）
        toast.error('第二堂資料格式與契約不符，已停止同步。請重新開啟「加速增長情境」儲存一次，或聯繫維護者。');
        return;
      }
      dispatch({ type: 'UPDATE_PROJECT_META', payload: { targetSnapshot: orient } });
      toast.success('已從第二堂同步成長差距');
    } catch (e) {
      console.error('[orient sync] failed:', e);
      toast.error('同步失敗，請稍後再試');
    } finally {
      setSyncing(false);
    }
  };

  const gapPct = snap && snap.momentum > 0 ? (snap.growthGap / snap.momentum) * 100 : 0;
  const currency = (snap && snap.currency) || 'TWD';

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold text-gray-800">成長差距（Aspiration − Momentum）</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors ${syncing ? 'opacity-60 cursor-wait' : ''}`}
        >
          {syncing ? '同步中…' : snap ? '重新同步第二堂' : '從第二堂同步'}
        </button>
      </div>
      {snap ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Aspiration 加速增長目標" value={fmt(snap.aspiration)} sub={currency} color="text-emerald-700" />
            <Stat label="Momentum 自然增長推估" value={fmt(snap.momentum)} sub={currency} color="text-gray-700" />
            <Stat label="成長差距" value={fmt(snap.growthGap)} sub={`${gapPct.toFixed(0)}% vs 自然增長`} color="text-amber-600" />
          </div>
          {snap.companyName && (
            <p className="text-xs text-gray-400 mt-3">資料來源：第二堂「{snap.companyName}」· 機會預估營收請以相同單位（{currency}）填寫，供綜合檢查 CHK-1 比對。</p>
          )}
        </>
      ) : (
        <div className="text-sm text-gray-500 bg-amber-50/60 border-l-4 border-amber-400 p-4 rounded-r-lg">
          尚未帶入第二堂的成長目標。請先完成「建立加速增長情境」並登入，再點右上「從第二堂同步」。成長差距 = Aspiration − Momentum，是後續機會缺口與綜合檢查 CHK-1 的基準。
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useDerived } from '../../hooks/useDerived';
import { navigate } from '../../lib/useHashRoute';

// 左側導覽（PRD 7.2.1 區 B）：主導覽順序即方法論順序，五步驟分組＋完成度提示
export default function SideNav({ activePath }) {
  const [collapsed, setCollapsed] = useState(false);
  const opportunities = useProjectStore((s) => s.opportunities);
  const rounds = useProjectStore((s) => s.rounds);
  const plays = useProjectStore((s) => s.plays);
  const handoffs = useProjectStore((s) => s.handoffs);
  const workshops = useProjectStore((s) => s.workshops);
  const project = useProjectStore((s) => s.project);
  const { rollup, checkRun } = useDerived();

  const shortlisted = opportunities.filter((o) => o.shortlist?.included).length;
  const confirmedTemplates = plays.reduce(
    (sum, p) => sum + ['t1', 't2', 't3'].filter((k) => p.templates?.[k]?.confirmed).length, 0
  );

  const groups = [
    { title: '工作台', items: [{ path: 'dashboard', label: '首頁總覽', hint: '' }] },
    {
      title: '步驟一 承接長清單',
      items: [{ path: 'longlist', label: '長清單承接與盤點', hint: opportunities.length ? `${opportunities.length} 個機會` : '未開始' }],
    },
    {
      title: '步驟二 評估與排序',
      items: [
        { path: 'criteria', label: '評估標準設定', hint: project?.criteria?.approved ? '已核定' : '未核定' },
        { path: 'scoring', label: '機會評分工作區', hint: rounds.length ? `第 ${rounds.length} 輪` : '未開始' },
        { path: 'matrix', label: '優先排序矩陣', hint: shortlisted ? `短名單 ${shortlisted}` : '—' },
        { path: 'workshop/1', label: '工作坊一（主持台）', hint: workshops.find((w) => w.n === 1)?.status === 'ended' ? '已結束' : '' },
      ],
    },
    {
      title: '步驟三 收斂策略方案',
      items: [{ path: 'plays', label: '策略方案編組', hint: `${plays.length} / 1–3` }],
    },
    {
      title: '步驟四 高階商業計劃',
      items: [{
        path: 'bizplan', label: '三模板與商業計劃',
        hint: plays.length ? `模板 ${confirmedTemplates}/${plays.length * 3}` : '—',
      }],
    },
    {
      title: '步驟五 疊加與時序',
      items: [
        { path: 'rollup', label: '疊加效益 Waterfall', hint: rollup.attainmentPct == null ? '—' : `${rollup.attainmentPct}%` },
        { path: 'sequencing', label: '時序與資源彙總', hint: '' },
        { path: 'consensus', label: '定位衝擊與共識', hint: '' },
        { path: 'workshop/2', label: '工作坊二（主持台）', hint: workshops.find((w) => w.n === 2)?.status === 'ended' ? '已結束' : '' },
      ],
    },
    {
      title: '交付',
      items: [
        { path: 'check', label: '綜合檢查', hint: checkRun.canDeliver ? '可交付' : '未過' },
        { path: 'handoff', label: '交付輸出', hint: handoffs.length ? `v${handoffs[0].version}` : '' },
      ],
    },
    {
      title: '協作',
      items: [{ path: 'board', label: '進度看板與稽核', hint: '' }],
    },
    { title: '設定', items: [{ path: 'settings', label: '設定與成員', hint: '' }] },
  ];

  if (collapsed) {
    return (
      <aside className="sticky top-14 h-[calc(100vh-56px)] w-10 shrink-0 border-r border-slate-200 bg-white">
        <button type="button" onClick={() => setCollapsed(false)} className="mt-2 w-full text-slate-500 hover:text-slate-700" title="展開導覽">»</button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-14 h-[calc(100vh-56px)] w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white pb-6">
      <div className="flex justify-end px-2 pt-2">
        <button type="button" onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-slate-600" title="收合導覽">«</button>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="px-3 pb-1 pt-3">
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500">{g.title}</div>
          {g.items.map((item) => {
            const active = activePath === item.path
              || (item.path === 'plays' && activePath === 'plays')
              || (item.path === 'bizplan' && ['bizplan'].includes(activePath));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                  active ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.hint ? <span className="shrink-0 text-[11px] text-slate-500">{item.hint}</span> : null}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

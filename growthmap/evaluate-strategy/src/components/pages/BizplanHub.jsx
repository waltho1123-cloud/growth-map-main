import { useProjectStore } from '../../store/useProjectStore';
import { navigate } from '../../lib/useHashRoute';
import { fmtAmount } from '../../lib/format';
import { Section, Chip, EmptyState, Btn } from '../common/ui';

// 步驟四樞紐：各方案的三模板／商業計劃完成度一覽（P-08/P-09 的入口）
export default function BizplanHub() {
  const plays = useProjectStore((s) => s.plays);
  const project = useProjectStore((s) => s.project);
  const years = Number(project?.settings?.forecastYears) || 3;

  if (plays.length === 0) {
    return (
      <EmptyState text="還沒有策略方案。先在步驟三把短名單機會整合／延伸成 1–3 個方案。"
        actionLabel="前往方案編組" onAction={() => navigate('plays')} />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">三模板與商業計劃</h2>
        <p className="text-xs text-slate-600">每個方案：先重整三模板（GR-6 逐張確認）→ 再填三年財務三表與可行性（GR-5 掛假設）。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plays.map((p) => {
          const confirmed = ['t1', 't2', 't3'].filter((k) => p.templates?.[k]?.confirmed).length;
          const y3 = p.bizplan?.fin?.pnl?.revenue?.[years - 1] || 0;
          const fz = p.bizplan?.feasibility || {};
          const fzDone = ['resources', 'regulation', 'culture', 'time'].every((k) => (fz[k]?.answer || '') !== '');
          return (
            <Section key={p.id} title={p.name || '未命名方案'}
              aside={<Chip tone={confirmed === 3 && y3 > 0 && fzDone ? 'ok' : 'idle'}>{confirmed === 3 && y3 > 0 && fzDone ? 'BP 完整' : '進行中'}</Chip>}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Chip tone={confirmed === 3 ? 'ok' : 'warn'}>模板 {confirmed}/3</Chip>
                <Chip tone={y3 > 0 ? 'ok' : 'warn'}>Y{years} 營收 {y3 > 0 ? fmtAmount(y3) : '未填'}</Chip>
                <Chip tone={fzDone ? 'ok' : 'warn'}>可行性四問{fzDone ? '已答' : '未完'}</Chip>
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => navigate(`plays/${p.id}/templates`)}>三模板重整</Btn>
                <Btn kind="primary" onClick={() => navigate(`plays/${p.id}/bizplan`)}>商業計劃</Btn>
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}

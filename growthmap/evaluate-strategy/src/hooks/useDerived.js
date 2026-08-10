// 衍生數字的單一計算點：達標水位、綜合檢查——TopBar/P-01/P-10/P-13 共用，
// 保證各處看到同一份判定（§8 資料完整性：單一來源）。

import { useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { computeRollup } from '../domain/rollup';
import { runChecks } from '../domain/checks';

export function useDerived() {
  const project = useProjectStore((s) => s.project);
  const opportunities = useProjectStore((s) => s.opportunities);
  const plays = useProjectStore((s) => s.plays);
  const assumptions = useProjectStore((s) => s.assumptions);

  return useMemo(() => {
    const settings = project?.settings || {};
    const years = Number(settings.forecastYears) || 3;
    const taxRate = Number.isFinite(Number(settings.taxRate)) ? Number(settings.taxRate) : 0.2;
    const target = project?.targetSnapshot || null;
    const synergies = project?.synergies || null;
    const rollup = computeRollup({
      momentum: target?.momentum || 0,
      aspiration: target?.aspiration || 0,
      plays,
      synergies,
      yearIndex: years - 1,
      metric: 'revenue',
      taxRate,
    });
    const checkRun = runChecks({
      momentum: target?.momentum || 0,
      aspiration: target?.aspiration || 0,
      opportunities,
      plays,
      synergies,
      assumptions,
      settings,
    });
    return { settings, years, taxRate, target, synergies, rollup, checkRun };
  }, [project, opportunities, plays, assumptions]);
}

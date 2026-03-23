'use client';

import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { DriverData } from '@/types';

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

interface WaterfallChartProps {
  drivers: DriverData[];
  mode: 'historical' | 'future';
  title?: string;
}

export default function WaterfallChart({ drivers, mode, title }: WaterfallChartProps) {
  const option = useMemo(() => {
    const values = drivers.map((d) =>
      mode === 'historical' ? d.historicalContribution : d.futureAssumption
    );
    const names = drivers.map((d) => {
      const parts = d.name.split(' → ');
      return parts[parts.length - 1] || d.name;
    });

    const total = values.reduce((s, v) => s + v, 0);

    // Build waterfall data: transparent base + colored bar
    const categories = ['起始', ...names, '合計'];

    // Starting value = 0 (we show growth from 0)
    let runningTotal = 0;

    // For each driver
    const finalBarData: (number | { value: number; itemStyle: { color: string } })[] = [];
    const finalTransparent: number[] = [];

    // "起始" bar
    finalTransparent.push(0);
    finalBarData.push({ value: 0, itemStyle: { color: 'transparent' } });

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val >= 0) {
        finalTransparent.push(runningTotal);
        finalBarData.push({ value: val, itemStyle: { color: '#22C55E' } });
      } else {
        finalTransparent.push(runningTotal + val);
        finalBarData.push({ value: Math.abs(val), itemStyle: { color: '#EF4444' } });
      }
      runningTotal += val;
    }

    // "合計" bar
    if (total >= 0) {
      finalTransparent.push(0);
      finalBarData.push({ value: total, itemStyle: { color: '#00A651' } });
    } else {
      finalTransparent.push(total);
      finalBarData.push({ value: Math.abs(total), itemStyle: { color: '#EF4444' } });
    }

    return {
      title: title ? {
        text: title,
        textStyle: { color: '#1b1f3b', fontSize: 16, fontWeight: 600 },
        left: 'center',
        top: 10,
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: 'rgba(0,0,0,0.08)',
        textStyle: { color: '#1b1f3b' },
        formatter: (params: Array<{ name: string; value: number; seriesIndex: number }>) => {
          const bar = params.find((p) => p.seriesIndex === 1);
          if (!bar) return '';
          const name = bar.name;
          if (name === '起始') return '起始基準: 0%';
          if (name === '合計') return `合計成長: ${total >= 0 ? '+' : ''}${total.toFixed(1)}%`;
          const idx = categories.indexOf(name) - 1;
          const val = values[idx];
          return `${name}: ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: title ? 50 : 20,
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: {
          color: '#6b7194',
          fontSize: 11,
          rotate: categories.length > 8 ? 30 : 0,
        },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#6b7194',
          formatter: '{value}%',
        },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
      },
      series: [
        {
          name: '透明底座',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          data: finalTransparent,
        },
        {
          name: '增減',
          type: 'bar',
          stack: 'waterfall',
          data: finalBarData,
          label: {
            show: true,
            position: 'top',
            color: '#1b1f3b',
            fontSize: 11,
            formatter: (p: { dataIndex: number }) => {
              const idx = p.dataIndex;
              if (idx === 0) return '';
              if (idx === categories.length - 1) return `${total >= 0 ? '+' : ''}${total.toFixed(1)}%`;
              const val = values[idx - 1];
              return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
            },
          },
          barMaxWidth: 50,
        },
      ],
    };
  }, [drivers, mode, title]);

  if (drivers.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <p className="text-gray-500">尚無驅動因子資料。請先完成 Step 2 設定。</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 420 }}
        notMerge={true}
      />
    </div>
  );
}

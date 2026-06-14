import ReactECharts from 'echarts-for-react';
import type { TemaColetivo } from '../../types/contrato';

interface Props {
  dados: TemaColetivo[];
  altura?: number;
}

export function TemasChart({ dados, altura = 160 }: Props) {
  const sorted = [...dados].sort((a, b) => b.quantidade - a.quantidade);
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.tema.length > 30 ? d.tema.slice(0, 28) + '…' : d.tema),
      axisLabel: { color: '#94a3b8', fontSize: 9 },
    },
    series: [{
      type: 'bar', data: sorted.map(d => d.quantidade),
      itemStyle: { color: '#2563eb', borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: 'right', color: '#94a3b8', fontSize: 9 },
    }],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}

import ReactECharts from 'echarts-for-react';
import type { HistoricoMensal } from '../../types/contrato';

interface Props {
  dados: HistoricoMensal[];
  altura?: number;
}

export function TendenciaChart({ dados, altura = 160 }: Props) {
  const meses     = dados.map(d => d.competencia.slice(0, 7));
  const atend     = dados.map(d => d.atendimentos);
  const proced    = dados.map(d => d.procedimentos);
  const meta      = dados.map(d => d.meta);
  const temMeta   = meta.some(v => v !== null);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 10 },
      itemWidth: 10, itemHeight: 2,
    },
    xAxis: {
      type: 'category', data: meses,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    series: [
      {
        name: 'Atendimentos', type: 'line', data: atend,
        lineStyle: { color: '#2563eb', width: 2 },
        itemStyle: { color: '#2563eb' }, smooth: true,
        symbol: 'circle', symbolSize: 4,
      },
      {
        name: 'Procedimentos', type: 'line', data: proced,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' }, smooth: true,
        symbol: 'circle', symbolSize: 4,
      },
      ...(temMeta ? [{
        name: 'Meta', type: 'line', data: meta,
        lineStyle: { color: '#f59e0b', width: 1, type: 'dashed' },
        itemStyle: { color: '#f59e0b' }, symbol: 'none',
      }] : []),
    ],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}

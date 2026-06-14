import ReactECharts from 'echarts-for-react';
import type { FaixaEtaria } from '../../types/contrato';

interface Props {
  dados: FaixaEtaria[];
  altura?: number;
}

export function PiramideChart({ dados, altura = 180 }: Props) {
  const faixas = [...dados].reverse().map(d => d.faixa);
  const masc   = [...dados].reverse().map(d => -d.masculino);
  const fem    = [...dados].reverse().map(d => d.feminino);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: any[]) =>
        `${params[0].name}<br/>Masc: ${Math.abs(params[0].value)}<br/>Fem: ${params[1].value}`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 9, formatter: (v: number) => Math.abs(v).toString() },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category', data: faixas,
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    series: [
      {
        name: 'Masculino', type: 'bar', stack: 'total', data: masc,
        itemStyle: { color: '#3b82f6' }, barMaxWidth: 20,
      },
      {
        name: 'Feminino', type: 'bar', stack: 'total', data: fem,
        itemStyle: { color: '#f472b6' }, barMaxWidth: 20,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}

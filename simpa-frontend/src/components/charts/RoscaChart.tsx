import ReactECharts from 'echarts-for-react';
import type { DistribuicaoTurno } from '../../types/contrato';

interface Props {
  dados: DistribuicaoTurno[];
  altura?: number;
}

const CORES = ['#2563eb', '#10b981', '#f59e0b'];

export function RoscaChart({ dados, altura = 160 }: Props) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['50%', '80%'],
      data: dados.map((d, i) => ({
        name: d.turno, value: d.atendimentos,
        itemStyle: { color: CORES[i % CORES.length] },
      })),
      label: { show: false },
      emphasis: { label: { show: false } },
    }],
  };

  return <ReactECharts option={option} style={{ height: altura }} />;
}

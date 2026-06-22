import { lazy, Suspense } from 'react';
import type { EChartProps } from './EChart';

const EChartLazy = lazy(() =>
  import('./EChart').then((module) => ({ default: module.EChart })),
);

function chartFallbackHeight(height: EChartProps['height']): number {
  return typeof height === 'number' ? height : 200;
}

export function EChart(props: EChartProps) {
  const minHeight = chartFallbackHeight(props.height);

  return (
    <Suspense
      fallback={
        <div
          className="analytics-state"
          style={{ minHeight, width: '100%' }}
          aria-hidden="true"
        />
      }
    >
      <EChartLazy {...props} />
    </Suspense>
  );
}

export {
  heroTrendOption,
  indicadorHistoryOption,
  situacaoTrendOption,
  sparklineOption,
  trendOption,
} from './chartOptions';

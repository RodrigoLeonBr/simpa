import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface EChartProps {
  option: EChartsCoreOption;
  className?: string;
  height?: number | string;
  testId?: string;
}

export function EChart({ option, className = '', height = 200, testId }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height }}
      data-testid={testId}
    />
  );
}

export function sparklineOption(series: number[], color: string): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: series.map((_, index) => index) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: series,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 2 },
      },
    ],
  };
}

export function trendOption(
  points: Array<{ competencia: string; atendimentos: number; meta: number | null }>,
  lineColor = '#0b5fad',
): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.competencia.slice(5)),
      axisLine: { lineStyle: { color: '#e2e9f1' } },
      axisLabel: { color: '#8595a8', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#8595a8', fontSize: 9 },
    },
    series: [
      {
        type: 'line',
        name: 'Atendimentos',
        data: points.map((point) => point.atendimentos),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: lineColor, width: 2.5 },
        itemStyle: { color: '#fff', borderColor: lineColor, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(11, 95, 173, 0.22)' },
              { offset: 1, color: 'rgba(11, 95, 173, 0)' },
            ],
          },
        },
      },
      {
        type: 'line',
        name: 'Meta',
        data: points.map((point) => point.meta),
        symbol: 'none',
        lineStyle: { color: '#0f1b2d', width: 1.5, type: 'dashed' },
      },
    ],
  };
}

export function indicadorHistoryOption(
  points: Array<{ competencia: string; exec: number | null }>,
  meta: number | null,
  lineColor = '#0b5fad',
): EChartsCoreOption {
  const execData = points.map((point) => (point.exec === null ? null : point.exec * 100));
  const metaData = points.map(() => (meta === null ? null : meta * 100));

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.competencia.slice(5)),
      axisLine: { lineStyle: { color: '#e2e9f1' } },
      axisLabel: { color: '#8595a8', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#8595a8', fontSize: 9 },
    },
    series: [
      {
        type: 'line',
        name: 'Executado',
        data: execData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: lineColor, width: 2.5 },
        itemStyle: { color: '#fff', borderColor: lineColor, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${lineColor}33` },
              { offset: 1, color: `${lineColor}00` },
            ],
          },
        },
      },
      {
        type: 'line',
        name: 'Meta',
        data: metaData,
        symbol: 'none',
        lineStyle: { color: '#0f1b2d', width: 1.5, type: 'dashed' },
      },
    ],
  };
}

export function situacaoTrendOption(
  points: Array<{ competencia: string; atendimentos: number; meta: number | null }>,
): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: '#6f86a3' },
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.competencia.slice(5)),
      axisLine: { lineStyle: { color: '#1c2c44' } },
      axisLabel: { color: '#6f86a3', fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1c2c44' } },
      axisLabel: { color: '#6f86a3', fontSize: 9 },
    },
    series: [
      {
        type: 'line',
        name: 'Atendimentos',
        data: points.map((point) => point.atendimentos),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#3b9bff', width: 2.5 },
        itemStyle: { color: '#9fd0ff', borderColor: '#3b9bff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(11, 95, 173, 0.55)' },
              { offset: 1, color: 'rgba(11, 95, 173, 0)' },
            ],
          },
        },
      },
      {
        type: 'line',
        name: 'Meta',
        data: points.map((point) => point.meta),
        symbol: 'none',
        lineStyle: { color: '#6f86a3', width: 1.5, type: 'dashed' },
      },
    ],
  };
}

export function heroTrendOption(series: number[]): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 8, bottom: 0 },
    xAxis: { type: 'category', show: false, data: series.map((_, index) => index) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: series,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#8fcaff', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(93, 176, 255, 0.5)' },
              { offset: 1, color: 'rgba(93, 176, 255, 0)' },
            ],
          },
        },
      },
    ],
  };
}

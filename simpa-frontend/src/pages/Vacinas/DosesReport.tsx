import { useEffect, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { fetchDosesResumo, fetchDosesFiltros } from '../../api/vacina';
import type { VacinaDosesResumo, VacinaDosesFiltros } from '../../types/vacina';
import { EChart } from '../../components/charts/EChart';
import { downloadCsv } from '../../utils/csv';

const MONTHS: Array<[string, string]> = [
  ['1', 'Janeiro'], ['2', 'Fevereiro'], ['3', 'Março'], ['4', 'Abril'],
  ['5', 'Maio'], ['6', 'Junho'], ['7', 'Julho'], ['8', 'Agosto'],
  ['9', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro'],
];

const BAR_COLOR = '#0b5fad';

function barOption(labels: string[], values: number[], horizontal = false): EChartsCoreOption {
  const cat = { type: 'category' as const, data: labels, axisLabel: { color: '#8595a8', fontSize: 9 } };
  const val = { type: 'value' as const, axisLabel: { color: '#8595a8', fontSize: 9 }, splitLine: { lineStyle: { color: '#eef2f7' } } };
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 12, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: horizontal ? val : cat,
    yAxis: horizontal ? { ...cat, inverse: true } : val,
    series: [{ type: 'bar', data: values, itemStyle: { color: BAR_COLOR, borderRadius: 3 } }],
  };
}

function lineOption(points: Array<{ competencia: string; doses: number }>): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: points.map((p) => p.competencia.slice(5)), axisLabel: { color: '#8595a8', fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { color: '#8595a8', fontSize: 9 }, splitLine: { lineStyle: { color: '#eef2f7' } } },
    series: [{ type: 'line', data: points.map((p) => p.doses), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: BAR_COLOR, width: 2.5 } }],
  };
}

type Persona = 'secretario' | 'coordenador' | 'vigilancia';

export function DosesReport() {
  const [filtros, setFiltros] = useState<VacinaDosesFiltros>({ anos: [], salas: [] });
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<string>(''); // '' = ano todo
  const [cnesSala, setCnesSala] = useState<string>(''); // '' = todas
  const [data, setData] = useState<VacinaDosesResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDosesFiltros()
      .then((f) => {
        setFiltros(f);
        if (f.anos.length > 0) setAno((prev) => (f.anos.includes(prev) ? prev : f.anos[0]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDosesResumo({ ano, mes: mes ? Number(mes) : null, cnes_sala: cnesSala || null })
      .then((r) => { setData(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ano, mes, cnesSala]);

  const ultimoMes = useMemo(() => {
    const withData = (data?.serie_mensal ?? []).filter((r) => r.doses > 0);
    return withData.length > 0 ? String(Number(withData[withData.length - 1].competencia.slice(5, 7))) : '';
  }, [data]);

  const applyPersona = (p: Persona) => {
    if (p === 'secretario') { setCnesSala(''); setMes(''); }
    else if (p === 'coordenador') { setCnesSala(filtros.salas[0]?.cnes_sala ?? ''); setMes(ultimoMes); }
    else { setCnesSala(''); setMes(ultimoMes); } // vigilancia: município, mês mais recente
  };

  return (
    <div data-testid="doses-report">
      <div className="vacinas-header-controls" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="vacinas-filter-select" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {(filtros.anos.length ? filtros.anos : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="vacinas-filter-select" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
          <option value="">Ano todo</option>
          {MONTHS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select className="vacinas-filter-select" value={cnesSala} onChange={(e) => setCnesSala(e.target.value)} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {filtros.salas.map((s) => <option key={s.cnes_sala} value={s.cnes_sala}>{s.sala_nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="vacinas-export-btn" onClick={() => applyPersona('secretario')}>Secretário</button>
          <button className="vacinas-export-btn" onClick={() => applyPersona('coordenador')}>Coordenador</button>
          <button className="vacinas-export-btn" onClick={() => applyPersona('vigilancia')}>Vigilância</button>
        </div>
      </div>

      {loading || !data ? (
        <p className="vacinas-state" data-testid="doses-loading">Carregando…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
            <div className="card" style={{ padding: 16, flex: 1 }}>
              <div className="mono">Doses no mês</div>
              <div style={{ fontSize: 28, fontWeight: 700 }} data-testid="doses-kpi-mes">{data.total_doses_mes.toLocaleString('pt-BR')}</div>
            </div>
            <div className="card" style={{ padding: 16, flex: 1 }}>
              <div className="mono">Acumulado no ano</div>
              <div style={{ fontSize: 28, fontWeight: 700 }} data-testid="doses-kpi-ano">{data.total_doses_ano.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <h3 className="cadastro-sync-title">Evolução mensal</h3>
            <EChart option={lineOption(data.serie_mensal)} height={220} testId="doses-chart-serie" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por vacina (acumulado)</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_vacina.csv', [{ key: 'imuno_nome', label: 'Vacina' }, { key: 'doses', label: 'Doses' }], data.por_vacina)} disabled={data.por_vacina.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_vacina.map((r) => r.imuno_nome), data.por_vacina.map((r) => r.doses))} height={220} testId="doses-chart-vacina" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por faixa etária (acumulado)</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_faixa.csv', [{ key: 'faixa_nies', label: 'Faixa' }, { key: 'doses', label: 'Doses' }], data.por_faixa)} disabled={data.por_faixa.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_faixa.map((r) => r.faixa_nies), data.por_faixa.map((r) => r.doses))} height={220} testId="doses-chart-faixa" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por unidade</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_unidade.csv', [{ key: 'sala_nome', label: 'Unidade' }, { key: 'doses', label: 'Doses' }], data.por_unidade)} disabled={data.por_unidade.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_unidade.map((r) => r.sala_nome), data.por_unidade.map((r) => r.doses), true)} height={Math.max(220, data.por_unidade.length * 26)} testId="doses-chart-unidade" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por mecanismo de registro</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_sistema.csv', [{ key: 'sistema_origem', label: 'Sistema' }, { key: 'doses', label: 'Doses' }], data.por_sistema)} disabled={data.por_sistema.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_sistema.map((r) => r.sistema_origem ?? '—'), data.por_sistema.map((r) => r.doses))} height={220} testId="doses-chart-sistema" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

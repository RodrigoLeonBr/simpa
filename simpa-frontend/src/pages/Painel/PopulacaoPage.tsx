import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPopulacao, fetchPopulacaoCompetencias } from '../../api/populacao';
import type {
  CompetenciaEntry,
  CondicoesSaude,
  FaixaEtaria,
  PopulacaoResponse,
} from '../../types/populacao';
import { EChart } from '../../components/charts/LazyEChart';
import { DashboardPageShell } from '../../components/shared/DashboardPageShell';
import { useFilters } from '../../hooks/useFilters';

// ── Condition display names ───────────────────────────────────────────────────

const CONDICAO_LABELS: Record<string, string> = {
  gestante: 'Gestante',
  hipertensao: 'Hipertensão',
  diabetes: 'Diabetes',
  fumante: 'Fumante',
  acamado: 'Acamado',
  avc_derrame: 'AVC/Derrame',
  cancer: 'Câncer',
  saude_mental: 'Saúde Mental',
  alcool: 'Álcool',
  tuberculose: 'Tuberculose',
  hanseniase: 'Hanseníase',
};

const PRIORITY_CONDITIONS = Object.keys(CONDICAO_LABELS);

// ── Pure data transformers (exported for tests) ───────────────────────────────

export interface PyramidSeries {
  categories: string[];
  masculino: number[];
  feminino: number[];
}

export function buildPyramidSeries(faixas: FaixaEtaria[]): PyramidSeries {
  const reversed = [...faixas].reverse();
  return {
    categories: reversed.map((f) => f.faixa),
    masculino: reversed.map((f) => -f.masculino),
    feminino: reversed.map((f) => f.feminino),
  };
}

export interface ConditionBar {
  key: string;
  label: string;
  count: number;
}

export interface FaixaComparisonRow {
  faixa: string;
  unidadeTotal: number;
  municipioTotal: number;
  unidadeShare: number;
  municipioShare: number;
  deltaSharePp: number;
}

export function buildConditionsData(
  condicoes: CondicoesSaude,
  _cidadaosAtivos: number,
): ConditionBar[] {
  return PRIORITY_CONDITIONS.filter((k) => k in condicoes)
    .map((key) => ({
      key,
      label: CONDICAO_LABELS[key] ?? key,
      count: condicoes[key]?.sim ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

function faixaTotal(faixa: FaixaEtaria): number {
  return (faixa.masculino ?? 0) + (faixa.feminino ?? 0) + (faixa.indeterminado ?? 0);
}

export function buildFaixaComparisonRows(
  unidadeFaixas: FaixaEtaria[],
  municipioFaixas: FaixaEtaria[],
): FaixaComparisonRow[] {
  const unidadeMap = new Map(unidadeFaixas.map((f) => [f.faixa, faixaTotal(f)]));
  const totalUnidade = unidadeFaixas.reduce((acc, faixa) => acc + faixaTotal(faixa), 0);
  const totalMunicipio = municipioFaixas.reduce((acc, faixa) => acc + faixaTotal(faixa), 0);

  return municipioFaixas.map((faixaMunicipio) => ({
    faixa: faixaMunicipio.faixa,
    unidadeTotal: unidadeMap.get(faixaMunicipio.faixa) ?? 0,
    municipioTotal: faixaTotal(faixaMunicipio),
    unidadeShare:
      totalUnidade > 0 ? ((unidadeMap.get(faixaMunicipio.faixa) ?? 0) / totalUnidade) * 100 : 0,
    municipioShare: totalMunicipio > 0 ? (faixaTotal(faixaMunicipio) / totalMunicipio) * 100 : 0,
    deltaSharePp:
      (totalUnidade > 0 ? ((unidadeMap.get(faixaMunicipio.faixa) ?? 0) / totalUnidade) * 100 : 0) -
      (totalMunicipio > 0 ? (faixaTotal(faixaMunicipio) / totalMunicipio) * 100 : 0),
  }));
}

function faixaProfileOption(rows: FaixaComparisonRow[]) {
  const ordered = [...rows].reverse();
  return {
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => `${v.toFixed(0)}%` },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((row) => row.faixa),
    },
    series: [
      {
        name: 'Unidade',
        type: 'bar',
        data: ordered.map((row) => Number(row.unidadeShare.toFixed(2))),
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: 'Município',
        type: 'bar',
        data: ordered.map((row) => Number(row.municipioShare.toFixed(2))),
        itemStyle: { color: '#9ca3af' },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ seriesName: string; value: number }>) =>
        params.map((p) => `${p.seriesName}: ${p.value.toFixed(2)}%`).join('<br/>'),
    },
    legend: { bottom: 0 },
  };
}

function renderDeltaLabel(deltaSharePp: number): string {
  if (Math.abs(deltaSharePp) < 0.05) {
    return 'Alinhado com a média municipal';
  }
  if (deltaSharePp > 0) {
    return `Acima da média (+${deltaSharePp.toFixed(1)} pp)`;
  }
  return `Abaixo da média (${deltaSharePp.toFixed(1)} pp)`;
}

// ── ECharts option builders ───────────────────────────────────────────────────

function pyramidOption(p: PyramidSeries) {
  return {
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => String(Math.abs(v)) },
    },
    yAxis: { type: 'category', data: p.categories },
    series: [
      {
        name: 'Masculino',
        type: 'bar',
        stack: 'pop',
        data: p.masculino,
        itemStyle: { color: '#3b82f6' },
        label: { show: false },
      },
      {
        name: 'Feminino',
        type: 'bar',
        stack: 'pop',
        data: p.feminino,
        itemStyle: { color: '#f43f5e' },
        label: { show: false },
      },
    ],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0 },
  };
}

function conditionsOption(bars: ConditionBar[]) {
  return {
    grid: { left: 110, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: bars.map((b) => b.label).reverse() },
    series: [
      {
        type: 'bar',
        data: bars.map((b) => b.count).reverse(),
        itemStyle: { color: '#10b981' },
        label: { show: true, position: 'right', formatter: '{c}' },
      },
    ],
    tooltip: { trigger: 'axis' },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PopulacaoPage() {
  const { competencia, unidadeId } = useFilters();
  const [competencias, setCompetencias] = useState<CompetenciaEntry[]>([]);
  const [data, setData] = useState<PopulacaoResponse | null | undefined>(undefined);
  const [municipioData, setMunicipioData] = useState<PopulacaoResponse | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPopulacaoCompetencias()
      .then(setCompetencias)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPopulacao(competencia)
      .then(async (municipio) => {
        if (unidadeId == null) {
          setMunicipioData(municipio);
          setData(municipio);
          setLoading(false);
          return;
        }

        const unidade = await fetchPopulacao(competencia, unidadeId);
        setMunicipioData(municipio);
        setData(unidade);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar dados de população');
        setLoading(false);
      });
  }, [competencia, unidadeId]);

  const pyramid = data ? buildPyramidSeries(data.faixa_etaria) : null;
  const conditions = data
    ? buildConditionsData(data.condicoes_saude, data.total_cidadaos_ativos)
    : [];
  const faixaComparison =
    unidadeId != null && data && municipioData
      ? buildFaixaComparisonRows(data.faixa_etaria, municipioData.faixa_etaria)
      : [];

  return (
    <DashboardPageShell
      loading={loading}
      error={error}
      loadingLabel="Carregando população cadastrada…"
      testId="populacao-page-shell"
    >
      {() => (
        <div className="populacao-page simpa-rise" data-testid="populacao-page">
          <div className="painel-header">
            <div>
              <h2 className="painel-title">População Cadastrada</h2>
              <p className="painel-subtitle">
                Relatório de cadastro individual · {competencia}
                {competencias.length > 0 &&
                  ` · ${competencias.find((c) => c.competencia.startsWith(competencia))?.unidades_count ?? 0} unidades`}
                {unidadeId != null && data?.por_unidade?.[0]?.estabelecimento_nome
                  ? ` · Unidade selecionada: ${data.por_unidade[0].estabelecimento_nome}`
                  : ''}
              </p>
            </div>
          </div>

          {data === null ? (
            <div className="analytics-state" data-testid="populacao-empty">
              <p>
                Dados não disponíveis — importe o relatório de cadastro individual
              </p>
              <Link to="/importacao" className="btn btn-primary">
                Ir para Importação
              </Link>
            </div>
          ) : data ? (
            <>
              {/* Summary cards */}
              <div className="kpi-grid-3" data-testid="populacao-cards">
                <div className="kpi-card card">
                  <span className="kpi-label">Cidadãos ativos</span>
                  <span className="kpi-value" data-testid="card-cidadaos-ativos">
                    {data.total_cidadaos_ativos.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Saídas do cadastro</span>
                  <span className="kpi-value" data-testid="card-saidas">
                    {data.total_saidas.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="kpi-card card">
                  <span className="kpi-label">Unidades importadas</span>
                  <span className="kpi-value" data-testid="card-unidades">
                    {data.por_unidade.length}
                  </span>
                </div>
              </div>

              {/* Demographic pyramid */}
              {pyramid && pyramid.categories.length > 0 && (
                <section className="card" data-testid="populacao-pyramid-section">
                  <h3>Pirâmide Etária</h3>
                  <EChart
                    option={pyramidOption(pyramid)}
                    height={360}
                    testId="pyramid-chart"
                  />
                  {faixaComparison.length > 0 && (
                    <div className="populacao-faixa-comparison" data-testid="populacao-faixa-comparison">
                      <p className="populacao-faixa-comparison-note">
                        Referência demográfica da unidade versus total do município.
                      </p>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Faixa etária</th>
                            <th>Unidade</th>
                            <th className="populacao-col-municipio">Município (cinza)</th>
                            <th>Diferença %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {faixaComparison.map((row) => {
                            return (
                              <tr key={row.faixa}>
                                <td>{row.faixa}</td>
                                <td>{row.unidadeTotal.toLocaleString('pt-BR')}</td>
                                <td className="populacao-col-municipio">
                                  {row.municipioTotal.toLocaleString('pt-BR')}
                                </td>
                                <td>{renderDeltaLabel(row.deltaSharePp)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="populacao-faixa-profile-chart">
                        <EChart
                          option={faixaProfileOption(faixaComparison)}
                          height={Math.max(240, faixaComparison.length * 26)}
                          testId="populacao-faixa-profile-chart"
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Health conditions chart */}
              {conditions.length > 0 && (
                <section className="card" data-testid="populacao-conditions-section">
                  <h3>Condições de Saúde</h3>
                  <EChart
                    option={conditionsOption(conditions)}
                    height={Math.max(160, conditions.length * 32)}
                    testId="conditions-chart"
                  />
                  <ul className="populacao-conditions-legend" aria-label="Condições de saúde">
                    {conditions.map((c) => (
                      <li key={c.key} data-condition={c.key}>
                        {c.label}: {c.count}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Per-unit table */}
              {data.por_unidade.length > 0 && (
                <section className="card" data-testid="populacao-units-table">
                  <h3>Por Unidade</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Cidadãos Ativos</th>
                        <th>Saídas</th>
                        <th>Última Importação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_unidade.map((u) => (
                        <tr key={u.estabelecimento_id} data-testid={`unit-row-${u.estabelecimento_id}`}>
                          <td>{u.estabelecimento_nome}</td>
                          <td>{u.cidadaos_ativos.toLocaleString('pt-BR')}</td>
                          <td>{u.saidas.toLocaleString('pt-BR')}</td>
                          <td>{new Date(u.importado_em).toLocaleDateString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          ) : null}
        </div>
      )}
    </DashboardPageShell>
  );
}

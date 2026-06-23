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
  const { competencia } = useFilters();
  const [competencias, setCompetencias] = useState<CompetenciaEntry[]>([]);
  const [data, setData] = useState<PopulacaoResponse | null | undefined>(undefined);
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
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar dados de população');
        setLoading(false);
      });
  }, [competencia]);

  const pyramid = data ? buildPyramidSeries(data.faixa_etaria) : null;
  const conditions = data
    ? buildConditionsData(data.condicoes_saude, data.total_cidadaos_ativos)
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

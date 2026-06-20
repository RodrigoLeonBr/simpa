import { useMemo, useState } from 'react';
import { ProgressBar } from '../../components/shared/ProgressBar';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { useDashboard } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import {
  buildBenchmarkRows,
  buildMapPins,
  buildRelatSintese,
  enrichIndicador,
} from '../../utils/indicadoresView';

export default function RelatoriosPage() {
  const { competencia } = useFilters();
  const { data, unidades, loading, error } = useDashboard();
  const { toast, showToast } = useToast();
  const indicadores = data?.indicadores_qualidade ?? [];
  const enriched = useMemo(() => indicadores.map(enrichIndicador), [indicadores]);
  const [selectedCod, setSelectedCod] = useState<string | null>(null);
  const activeCod = selectedCod ?? enriched[0]?.indicador.cod ?? null;
  const selected = enriched.find((item) => item.indicador.cod === activeCod) ?? enriched[0] ?? null;

  const benchmarkRows = useMemo(
    () =>
      selected
        ? buildBenchmarkRows(selected.indicador, unidades, data?.filtros_ativos.unidade)
        : [],
    [selected, unidades, data?.filtros_ativos.unidade],
  );
  const sintese = useMemo(
    () => (selected ? buildRelatSintese(selected.indicador, benchmarkRows) : []),
    [selected, benchmarkRows],
  );
  const mapPins = useMemo(() => buildMapPins(benchmarkRows), [benchmarkRows]);

  if (loading) {
    return <div className="analytics-state">Carregando relatórios…</div>;
  }

  if (error || !data || !selected) {
    return <div className="analytics-state analytics-state-error">{error ?? 'Relatórios indisponíveis'}</div>;
  }

  return (
    <div className="analytics-page simpa-rise">
      <ToastBanner message={toast.message} visible={toast.visible} />

      <div className="relatorios-top">
        <div>
          <h2 className="analytics-title">Comparativo entre Unidades</h2>
          <p className="analytics-subtitle">
            Benchmarking · {selected.indicador.cod} {selected.indicador.nomeCurto} · competência {competencia}
          </p>
        </div>
        <div className="relatorios-actions">
          <button type="button" className="relatorios-export-btn" onClick={() => showToast('Em breve')}>
            ⤓ Excel
          </button>
          <button
            type="button"
            className="relatorios-export-btn primary"
            onClick={() => showToast('Em breve')}
          >
            ⤓ PDF
          </button>
        </div>
      </div>

      <div className="relatorios-selector card">
        <label className="relatorios-selector-label" htmlFor="relatorio-indicador">
          Indicador
        </label>
        <select
          id="relatorio-indicador"
          className="relatorios-selector-input"
          value={selected.indicador.cod}
          onChange={(event) => setSelectedCod(event.target.value)}
        >
          {enriched.map((item) => (
            <option key={item.indicador.cod} value={item.indicador.cod}>
              {item.indicador.cod} · {item.indicador.nomeCurto}
            </option>
          ))}
        </select>
      </div>

      <div className="relatorios-grid">
        <section className="card relatorios-table-card">
          <div className="relatorios-table-head">Ranking de unidades</div>
          <div className="relatorios-table-wrap">
            <table className="relatorios-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Unidade</th>
                  <th>Tipo</th>
                  <th>Atingimento</th>
                  <th className="align-right">vs. média</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkRows.map((row) => (
                  <tr key={row.nome}>
                    <td className="mono relatorios-rank">{row.rank}</td>
                    <td>{row.nome}</td>
                    <td>
                      <span className="relatorios-type-badge">{row.tipo}</span>
                    </td>
                    <td>
                      <div className="relatorios-progress-cell">
                        <ProgressBar execWidthPct={row.widthPct} color={row.color} height={9} compact />
                        <span className="mono relatorios-progress-value" style={{ color: row.color }}>
                          {row.execText}
                        </span>
                      </div>
                    </td>
                    <td className="mono align-right" style={{ color: row.diffColor, fontWeight: 600 }}>
                      {row.diffText}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="relatorios-side">
          <section className="card relatorios-map-card">
            <h3>Distribuição por unidade</h3>
            <p className="relatorios-map-sub">{benchmarkRows.length} unidades · APS Americana/SP</p>
            <div className="relatorios-map-placeholder">
              <svg viewBox="0 0 320 200" className="relatorios-map-hatch" aria-hidden="true">
                <defs>
                  <pattern id="relatorio-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#c3cedb" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="320" height="200" fill="url(#relatorio-hatch)" />
              </svg>
              {mapPins.map((pin, index) => (
                <span
                  key={`${pin.x}-${index}`}
                  className="relatorios-map-pin"
                  style={{
                    left: pin.x,
                    top: pin.y,
                    width: pin.size,
                    height: pin.size,
                    background: pin.color,
                  }}
                />
              ))}
              <span className="mono relatorios-map-caption">[ mapa georreferenciado · placeholder ]</span>
            </div>
            <p className="relatorios-map-note">
              Tamanho do ponto = volume de atendimentos · cor = atingimento da meta. Substituir por camada GeoJSON
              dos bairros.
            </p>
          </section>

          <section className="card relatorios-sintese-card">
            <h3>Síntese municipal</h3>
            <div className="relatorios-sintese-list">
              {sintese.map((row) => (
                <div key={row.label} className="relatorios-sintese-row">
                  <span>{row.label}</span>
                  <span className="mono" style={{ color: row.color, fontWeight: 600 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

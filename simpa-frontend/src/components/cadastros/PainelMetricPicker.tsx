import type { PainelMetricaCatalogo, PainelWidgetConfig } from '../../types/painelWidgets';

interface PainelMetricPickerProps {
  metricQuery: string;
  metricBusy: boolean;
  selectedMetric: PainelMetricaCatalogo | null;
  onQueryChange: (query: string) => void;
}

export function PainelMetricPicker({
  metricQuery,
  metricBusy,
  selectedMetric,
  onQueryChange,
}: PainelMetricPickerProps) {
  return (
    <div className="cadastro-field" data-testid="metric-picker">
      <span>Buscar métrica no catálogo</span>
      <input
        type="search"
        value={metricQuery}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Digite parte do nome da métrica..."
        data-testid="metric-search-input"
      />
      {metricBusy ? <span className="cadastro-field-hint">Buscando métricas...</span> : null}
      {selectedMetric ? (
        <p className="cadastro-field-hint" data-testid="selected-metric-summary">
          {selectedMetric.label} · {selectedMetric.fonte_tipo} · {selectedMetric.chave}
        </p>
      ) : null}
    </div>
  );
}

export function resolveSelectedMetric(
  metricaId: string,
  metricOptions: PainelMetricaCatalogo[],
  rows: PainelWidgetConfig[],
): PainelMetricaCatalogo | null {
  if (!metricaId) return null;
  return (
    metricOptions.find((metric) => String(metric?.id) === metricaId) ??
    rows.find((row) => String(row.metrica?.id) === metricaId)?.metrica ??
    null
  );
}

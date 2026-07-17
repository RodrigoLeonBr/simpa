import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchEstabelecimentosAps } from '../../api/cadastros';
import { fetchPainelMetrica, fetchPainelMetricas, previewPainelWidget } from '../../api/painelWidgets';
import { DEFAULT_COMPETENCIAS } from '../../config/navigation';
import type { CadastroFieldDef } from '../../config/cadastroEntities';
import type { Estabelecimento } from '../../types/cadastros';
import type { PainelMetricaCatalogo, PainelWidgetConfig, ResolvedPainelWidget } from '../../types/painelWidgets';
import { activeEstabelecimentos } from '../../utils/estabelecimentosView';
import { EM_DASH } from '../../utils/kpi';
import {
  mapWidgetFormPayload,
  type PainelWidgetPerfil,
  WIDGET_FIELDS,
  WIDGET_FORMATO_SELECT_OPTIONS,
  WIDGET_TIPO_SELECT_OPTIONS,
  widgetRowToFormValues,
} from '../../utils/indicadoresPainelView';
import { PAINEL_SQL_EXAMPLE_GROUPS, type PainelSqlExample } from '../../utils/painelWidgetSqlExamples';
import { validateCadastroForm } from '../../utils/cadastroView';
import { useDebounce } from '../../hooks/useDebounce';
import { ModalPortal } from './ModalPortal';

export interface WidgetEditSubmitPayload extends Partial<PainelWidgetConfig> {
  sql_override?: string | null;
  spark_sql_override?: string | null;
}

interface WidgetEditDrawerProps {
  open: boolean;
  title: string;
  perfil: PainelWidgetPerfil;
  editingRow: PainelWidgetConfig | null;
  onClose: () => void;
  onSubmit: (payload: WidgetEditSubmitPayload, editing: PainelWidgetConfig | null) => Promise<void>;
  onError: (message: string) => void;
}

function buildSelectOptions(metrics: PainelMetricaCatalogo[]) {
  return {
    tipo: WIDGET_TIPO_SELECT_OPTIONS,
    formato: WIDGET_FORMATO_SELECT_OPTIONS,
    metrica_id: metrics.map((metric) => ({
      value: String(metric.id),
      label: `${metric.label} (${metric.chave})`,
    })),
    spark_metrica_id: [
      { value: '', label: 'Sem sparkline' },
      ...metrics.map((metric) => ({
        value: String(metric.id),
        label: `${metric.label} (${metric.chave})`,
      })),
    ],
  };
}

function mergeMetricOption(
  options: PainelMetricaCatalogo[],
  metric: PainelMetricaCatalogo | null,
): PainelMetricaCatalogo[] {
  if (!metric) return options;
  if (options.some((item) => item.id === metric.id)) return options;
  return [metric, ...options];
}

interface SqlEditorBlockProps {
  label: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  catalogSql: string;
  onRestoreCatalog: () => void;
  onApplyExample: (example: PainelSqlExample) => void;
  exampleFilter: 'main' | 'spark';
  testId: string;
}

function SqlEditorBlock({
  label,
  enabled,
  onEnabledChange,
  value,
  onChange,
  catalogSql,
  onRestoreCatalog,
  onApplyExample,
  exampleFilter,
  testId,
}: SqlEditorBlockProps) {
  return (
    <section className="widget-sql-editor-block" data-testid={testId}>
      <div className="widget-sql-editor-head">
        <label className="widget-sql-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            data-testid={`${testId}-toggle`}
          />
          <span>{label}</span>
        </label>
        {enabled ? (
          <button type="button" className="cadastro-btn ghost widget-sql-restore" onClick={onRestoreCatalog}>
            Restaurar catálogo
          </button>
        ) : null}
      </div>
      {enabled ? (
        <textarea
          className="widget-sql-textarea mono"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          rows={12}
          data-testid={`${testId}-textarea`}
        />
      ) : (
        <pre className="widget-sql-catalog-readonly mono" data-testid={`${testId}-catalog`}>
          {catalogSql || '— Sem template no catálogo —'}
        </pre>
      )}
      <details className="widget-sql-inline-examples">
        <summary>Inserir exemplo neste campo</summary>
        <ul className="widget-sql-example-list">
          {PAINEL_SQL_EXAMPLE_GROUPS.flatMap((group) =>
            group.examples
              .filter((item) => item.target === exampleFilter || item.target === 'both')
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="widget-sql-example-btn"
                    onClick={() => onApplyExample(item)}
                  >
                    {item.title}
                  </button>
                </li>
              )),
          )}
        </ul>
      </details>
    </section>
  );
}

export function WidgetEditDrawer({
  open,
  title,
  perfil,
  editingRow,
  onClose,
  onSubmit,
  onError,
}: WidgetEditDrawerProps) {
  const [values, setValues] = useState<Record<string, string>>(widgetRowToFormValues(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [metricQuery, setMetricQuery] = useState('');
  const [metricOptions, setMetricOptions] = useState<PainelMetricaCatalogo[]>([]);
  const [metricBusy, setMetricBusy] = useState(false);
  const [mainCatalog, setMainCatalog] = useState<PainelMetricaCatalogo | null>(null);
  const [sparkCatalog, setSparkCatalog] = useState<PainelMetricaCatalogo | null>(null);
  const [useCustomMain, setUseCustomMain] = useState(false);
  const [useCustomSpark, setUseCustomSpark] = useState(false);
  const [sqlMain, setSqlMain] = useState('');
  const [sqlSpark, setSqlSpark] = useState('');
  const [activeExampleId, setActiveExampleId] = useState(PAINEL_SQL_EXAMPLE_GROUPS[0]?.id ?? 'contrato');
  const [competencia, setCompetencia] = useState(DEFAULT_COMPETENCIAS[0] ?? '2026-05');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewResult, setPreviewResult] = useState<ResolvedPainelWidget | null>(null);
  const debouncedMetricQuery = useDebounce(metricQuery, 300);

  const resetFromRow = useCallback(async (row: PainelWidgetConfig | null) => {
    setValues(widgetRowToFormValues(row));
    setErrors({});
    setSubmitting(false);
    setMetricQuery('');
    setPreviewResult(null);
    setPreviewBusy(false);
    setCompetencia(DEFAULT_COMPETENCIAS[0] ?? '2026-05');
    setEstabelecimentoId('');

    let mainMetric: PainelMetricaCatalogo | null = row?.metrica ?? null;
    let sparkMetric: PainelMetricaCatalogo | null = null;

    if (row?.metrica_id) {
      try {
        mainMetric = await fetchPainelMetrica(row.metrica_id);
      } catch {
        /* keep embedded metric if any */
      }
    }
    if (row?.spark_metrica_id) {
      try {
        sparkMetric = await fetchPainelMetrica(row.spark_metrica_id);
      } catch {
        sparkMetric = null;
      }
    }

    setMainCatalog(mainMetric);
    setSparkCatalog(sparkMetric);
    setUseCustomMain(Boolean(row?.sql_override?.trim()));
    setUseCustomSpark(Boolean(row?.spark_sql_override?.trim()));
    setSqlMain(row?.sql_override?.trim() || mainMetric?.sql_template || '');
    setSqlSpark(row?.spark_sql_override?.trim() || sparkMetric?.sql_template || '');
  }, []);

  useEffect(() => {
    if (!open) return;
    void resetFromRow(editingRow);
  }, [open, editingRow, resetFromRow]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadEstabelecimentos() {
      try {
        const rows = await fetchEstabelecimentosAps();
        if (!cancelled) setEstabelecimentos(rows);
      } catch {
        if (!cancelled) setEstabelecimentos([]);
      }
    }

    void loadEstabelecimentos();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadMetrics() {
      setMetricBusy(true);
      try {
        const response = await fetchPainelMetricas({
          q: debouncedMetricQuery || undefined,
          limit: 30,
          page: 1,
        });
        if (!cancelled) {
          setMetricOptions(
            mergeMetricOption(
              mergeMetricOption(response.data, mainCatalog),
              sparkCatalog,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setMetricOptions(mergeMetricOption(mergeMetricOption([], mainCatalog), sparkCatalog));
          onError(err instanceof Error ? err.message : 'Falha ao carregar métricas');
        }
      } finally {
        if (!cancelled) setMetricBusy(false);
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedMetricQuery, mainCatalog, sparkCatalog, onError]);

  useEffect(() => {
    if (!open) return;
    const metricId = values.metrica_id;
    if (!metricId) {
      setMainCatalog(null);
      if (!useCustomMain) setSqlMain('');
      return;
    }
    if (mainCatalog && String(mainCatalog.id) === metricId) return;

    let cancelled = false;
    void fetchPainelMetrica(Number(metricId))
      .then((metric) => {
        if (cancelled) return;
        setMainCatalog(metric);
        if (!useCustomMain) {
          setSqlMain(metric.sql_template || '');
        }
      })
      .catch(() => {
        if (!cancelled) setMainCatalog(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, values.metrica_id, mainCatalog, useCustomMain]);

  useEffect(() => {
    if (!open) return;
    const sparkId = values.spark_metrica_id;
    if (!sparkId) {
      setSparkCatalog(null);
      if (!useCustomSpark) setSqlSpark('');
      return;
    }
    if (sparkCatalog && String(sparkCatalog.id) === sparkId) return;

    let cancelled = false;
    void fetchPainelMetrica(Number(sparkId))
      .then((metric) => {
        if (cancelled) return;
        setSparkCatalog(metric);
        if (!useCustomSpark) {
          setSqlSpark(metric.sql_template || '');
        }
      })
      .catch(() => {
        if (!cancelled) setSparkCatalog(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, values.spark_metrica_id, sparkCatalog, useCustomSpark]);

  const selectOptions = useMemo(() => buildSelectOptions(metricOptions), [metricOptions]);
  const activeGroup = PAINEL_SQL_EXAMPLE_GROUPS.find((group) => group.id === activeExampleId);
  const estabelecimentoOptions = activeEstabelecimentos(estabelecimentos);

  const previewPayload = useMemo((): WidgetEditSubmitPayload => {
    const base = mapWidgetFormPayload(values, perfil);
    return {
      ...base,
      sql_override: useCustomMain ? sqlMain.trim() || null : null,
      spark_sql_override: useCustomSpark ? sqlSpark.trim() || null : null,
      sql_preview: useCustomMain ? sqlMain.trim() || null : mainCatalog?.sql_template || null,
    };
  }, [values, perfil, useCustomMain, useCustomSpark, sqlMain, sqlSpark, mainCatalog]);

  async function handlePreview() {
    setPreviewBusy(true);
    setPreviewResult(null);
    try {
      const result = await previewPainelWidget({
        widgetId: editingRow?.id,
        widget: editingRow ? { ...editingRow, ...previewPayload } : previewPayload,
        scope: {
          competencia,
          estabelecimentoId: estabelecimentoId ? Number(estabelecimentoId) : undefined,
        },
      });
      setPreviewResult(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao testar query');
    } finally {
      setPreviewBusy(false);
    }
  }

  function applyExample(example: PainelSqlExample, target: 'main' | 'spark') {
    if (target === 'main') {
      setUseCustomMain(true);
      setSqlMain(example.sql);
    } else {
      setUseCustomSpark(true);
      setSqlSpark(example.sql);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateCadastroForm(values, WIDGET_FIELDS as CadastroFieldDef[]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(previewPayload, editingRow);
      onClose();
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Falha ao salvar',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const hasRequiredEmpty = WIDGET_FIELDS.some((field) => field.required && !values[field.key]?.trim());

  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="widget-edit-backdrop">
        <div
          className="cadastro-dialog card widget-edit-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="widget-edit-title"
          data-testid="widget-edit-drawer"
        >
          <div className="cadastro-dialog-head">
            <div>
              <h3 id="widget-edit-title">{title}</h3>
              <p className="widget-edit-subtitle">
                SQL customizado por widget · placeholders{' '}
                <code>:competencia</code>, <code>:estabelecimento_id</code>, <code>:equipe_id</code>
              </p>
            </div>
            <button type="button" className="cadastro-dialog-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>

          <form className="widget-edit-body" onSubmit={(event) => void handleSubmit(event)}>
            <div className="widget-edit-layout">
              <div className="widget-edit-main">
                <section className="widget-edit-section">
                  <h4>Identidade do widget</h4>
                  <div className="widget-edit-meta-grid">
                    {WIDGET_FIELDS.filter((field) =>
                      ['slug', 'titulo', 'subtitulo', 'tipo', 'formato'].includes(field.key),
                    ).map((field) => {
                      const error = errors[field.key];
                      const options = selectOptions[field.key as keyof typeof selectOptions] ?? [];
                      return (
                        <label key={field.key} className="cadastro-field" htmlFor={`widget-field-${field.key}`}>
                          <span>{field.label}</span>
                          {field.type === 'select' ? (
                            <select
                              id={`widget-field-${field.key}`}
                              value={values[field.key] ?? ''}
                              onChange={(event) =>
                                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                              }
                              className={field.mono ? 'mono' : undefined}
                            >
                              <option value="">Selecione…</option>
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`widget-field-${field.key}`}
                              type="text"
                              value={values[field.key] ?? ''}
                              onChange={(event) =>
                                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                              }
                              className={field.mono ? 'mono' : undefined}
                            />
                          )}
                          {error ? <span className="cadastro-field-error">{error}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="widget-edit-section">
                  <h4>Métricas vinculadas</h4>
                  <label className="cadastro-field">
                    <span>Buscar no catálogo</span>
                    <input
                      type="search"
                      value={metricQuery}
                      onChange={(event) => setMetricQuery(event.target.value)}
                      placeholder="Nome ou chave (ex.: sia.taxa_glosa)…"
                      data-testid="metric-search-input"
                    />
                    {metricBusy ? <span className="cadastro-field-hint">Buscando…</span> : null}
                  </label>
                  <div className="widget-edit-meta-grid">
                    {WIDGET_FIELDS.filter((field) =>
                      ['metrica_id', 'spark_metrica_id'].includes(field.key),
                    ).map((field) => {
                      const error = errors[field.key];
                      const options = selectOptions[field.key as keyof typeof selectOptions] ?? [];
                      return (
                        <label key={field.key} className="cadastro-field" htmlFor={`widget-field-${field.key}`}>
                          <span>{field.label}</span>
                          <select
                            id={`widget-field-${field.key}`}
                            value={values[field.key] ?? ''}
                            onChange={(event) =>
                              setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                            }
                          >
                            {field.key === 'spark_metrica_id' ? null : (
                              <option value="">Selecione…</option>
                            )}
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {error ? <span className="cadastro-field-error">{error}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </section>

                <SqlEditorBlock
                  label="SQL customizado — métrica principal"
                  enabled={useCustomMain}
                  onEnabledChange={(checked) => {
                    setUseCustomMain(checked);
                    if (checked && !sqlMain.trim()) {
                      setSqlMain(mainCatalog?.sql_template || '');
                    }
                  }}
                  value={sqlMain}
                  onChange={setSqlMain}
                  catalogSql={mainCatalog?.sql_template || ''}
                  onRestoreCatalog={() => {
                    setUseCustomMain(false);
                    setSqlMain(mainCatalog?.sql_template || '');
                  }}
                  onApplyExample={(example) => applyExample(example, 'main')}
                  exampleFilter="main"
                  testId="widget-sql-main"
                />

                {values.spark_metrica_id ? (
                  <SqlEditorBlock
                    label="SQL customizado — sparkline"
                    enabled={useCustomSpark}
                    onEnabledChange={(checked) => {
                      setUseCustomSpark(checked);
                      if (checked && !sqlSpark.trim()) {
                        setSqlSpark(sparkCatalog?.sql_template || '');
                      }
                    }}
                    value={sqlSpark}
                    onChange={setSqlSpark}
                    catalogSql={sparkCatalog?.sql_template || ''}
                    onRestoreCatalog={() => {
                      setUseCustomSpark(false);
                      setSqlSpark(sparkCatalog?.sql_template || '');
                    }}
                    onApplyExample={(example) => applyExample(example, 'spark')}
                    exampleFilter="spark"
                    testId="widget-sql-spark"
                  />
                ) : null}

                <section className="widget-edit-section widget-edit-preview">
                  <h4>Testar execução</h4>
                  <div className="widget-edit-preview-controls">
                    <label className="cadastro-field">
                      <span>Competência</span>
                      <select
                        className="mono"
                        value={competencia}
                        onChange={(event) => setCompetencia(event.target.value)}
                        data-testid="widget-edit-competencia"
                      >
                        {DEFAULT_COMPETENCIAS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cadastro-field">
                      <span>Estabelecimento</span>
                      <select
                        value={estabelecimentoId}
                        onChange={(event) => setEstabelecimentoId(event.target.value)}
                        data-testid="widget-edit-estabelecimento"
                      >
                        <option value="">Municipal (todas)</option>
                        {estabelecimentoOptions.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="cadastro-btn primary"
                      disabled={previewBusy}
                      onClick={() => void handlePreview()}
                      data-testid="widget-edit-preview-run"
                    >
                      {previewBusy ? 'Executando…' : 'Executar teste'}
                    </button>
                  </div>
                  {previewResult ? (
                    <div className="widget-edit-preview-result" data-testid="widget-edit-preview-result">
                      <p className="widget-preview-value mono">{previewResult.valueLabel || EM_DASH}</p>
                      {previewResult.sparkSeries?.length ? (
                        <p className="cadastro-field-hint">
                          Sparkline: {previewResult.sparkSeries.length} pontos · último{' '}
                          {previewResult.sparkSeries[previewResult.sparkSeries.length - 1]}
                        </p>
                      ) : null}
                      {previewResult.series?.length ? (
                        <p className="cadastro-field-hint">
                          Série: {previewResult.series.length} competências
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="widget-edit-aside">
                <h4>Referência SQL</h4>
                <div className="widget-sql-ref-tabs">
                  {PAINEL_SQL_EXAMPLE_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className={`widget-sql-ref-tab${activeExampleId === group.id ? ' active' : ''}`}
                      onClick={() => setActiveExampleId(group.id)}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                {activeGroup?.examples.map((example) => (
                  <article key={example.id} className="widget-sql-ref-card">
                    <header>
                      <strong>{example.title}</strong>
                      <span className="widget-sql-ref-target">
                        {example.target === 'main'
                          ? 'principal'
                          : example.target === 'spark'
                            ? 'sparkline'
                            : 'ambos'}
                      </span>
                    </header>
                    <p className="cadastro-field-hint">{example.hint}</p>
                    <pre className="widget-sql-ref-pre mono">{example.sql}</pre>
                    <div className="widget-sql-ref-actions">
                      {(example.target === 'main' || example.target === 'both') && (
                        <button
                          type="button"
                          className="cadastro-btn ghost"
                          onClick={() => applyExample(example, 'main')}
                        >
                          → Principal
                        </button>
                      )}
                      {(example.target === 'spark' || example.target === 'both') && (
                        <button
                          type="button"
                          className="cadastro-btn ghost"
                          onClick={() => applyExample(example, 'spark')}
                        >
                          → Sparkline
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </aside>
            </div>

            {errors._form ? <p className="cadastro-form-error">{errors._form}</p> : null}

            <div className="widget-edit-footer cadastro-form-actions">
              <button type="button" className="cadastro-btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="cadastro-btn primary"
                disabled={submitting || hasRequiredEmpty || !values.titulo?.trim()}
              >
                {submitting ? 'Salvando…' : 'Salvar widget'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

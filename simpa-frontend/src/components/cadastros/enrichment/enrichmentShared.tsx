import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { EstabelecimentoEnrichment } from '../../../types/cadastros';
import type { EnrichmentFormPayload } from '../../../utils/enrichmentByPerfil';
import { LEITOS_KEYS } from '../../../utils/enrichmentView';

export const LEITO_LABELS: Record<(typeof LEITOS_KEYS)[number], string> = {
  clinico: 'Clínico',
  cirurgico: 'Cirúrgico',
  obstetrico: 'Obstétrico',
  pediatrico: 'Pediátrico',
  uti: 'UTI',
};

export interface EnrichmentPerfilFormProps {
  enrichment?: EstabelecimentoEnrichment;
  readOnly?: boolean;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}

export function FormShell({
  children,
  errors,
  submitting,
  onSubmit,
  testId,
}: {
  children: ReactNode;
  errors: Record<string, string>;
  submitting: boolean;
  onSubmit: (event: FormEvent) => void;
  testId: string;
}) {
  return (
    <form
      className="cadastro-form cadastro-enrichment-form"
      data-testid={testId}
      noValidate
      onSubmit={onSubmit}
    >
      {children}
      {errors._form ? <p className="cadastro-form-error">{errors._form}</p> : null}
      <div className="cadastro-form-actions">
        <button type="submit" className="cadastro-btn primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar enriquecimento'}
        </button>
      </div>
    </form>
  );
}

export function LeitosFields({
  values,
  errors,
  onChange,
}: {
  values: Record<(typeof LEITOS_KEYS)[number], string>;
  errors: Record<string, string>;
  onChange: (next: Record<(typeof LEITOS_KEYS)[number], string>) => void;
}) {
  return (
    <fieldset className="cadastro-enrichment-fieldset">
      <legend>Leitos</legend>
      <div className="cadastro-enrichment-leitos">
        {LEITOS_KEYS.map((key) => (
          <label key={key} className="cadastro-field">
            <span>{LEITO_LABELS[key]}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={values[key]}
              onChange={(event) =>
                onChange({
                  ...values,
                  [key]: event.target.value,
                })
              }
            />
            {errors[`leitos.${key}`] ? (
              <span className="cadastro-field-error">{errors[`leitos.${key}`]}</span>
            ) : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReadonlyFieldList({
  testId,
  fields,
  values,
}: {
  testId: string;
  fields: { key: string; label: string }[];
  values: Record<string, string>;
}) {
  return (
    <div className="cadastro-enrichment-readonly" data-testid={testId}>
      {fields.map((field) => (
        <div key={field.key} className="cadastro-field cadastro-field-locked">
          <span>{field.label}</span>
          <p>{values[field.key]?.trim() ? values[field.key] : '—'}</p>
        </div>
      ))}
    </div>
  );
}

export function TextEnrichmentForm({
  testId,
  enrichment,
  readOnly,
  toValues,
  toPayload,
  fields,
  onSubmit,
}: {
  testId: string;
  enrichment?: EstabelecimentoEnrichment;
  readOnly?: boolean;
  toValues: (value?: EstabelecimentoEnrichment) => Record<string, string>;
  toPayload: (values: Record<string, string>) => EnrichmentFormPayload;
  fields: { key: string; label: string; rows?: number }[];
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => toValues(enrichment));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(toValues(enrichment));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when enrichment changes
  }, [enrichment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Falha ao salvar enriquecimento',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (readOnly) {
    return <ReadonlyFieldList testId={`${testId}-readonly`} fields={fields} values={values} />;
  }

  return (
    <FormShell
      testId={testId}
      errors={errors}
      submitting={submitting}
      onSubmit={(event) => void handleSubmit(event)}
    >
      {fields.map((field) => (
        <label key={field.key} className="cadastro-field">
          <span>{field.label}</span>
          <textarea
            rows={field.rows ?? 3}
            value={values[field.key] ?? ''}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.key]: event.target.value }))
            }
          />
        </label>
      ))}
    </FormShell>
  );
}

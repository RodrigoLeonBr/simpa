import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  EnrichmentAps,
  EnrichmentHospitalar,
  EnrichmentMac,
  EnrichmentMisto,
  EnrichmentOutro,
  EstabelecimentoEnrichment,
  EstabelecimentoPerfil,
} from '../../types/cadastros';
import {
  apsEnrichmentToFormValues,
  apsFormValuesToPayload,
  enrichmentSectionTitle,
  macEnrichmentToFormValues,
  macFormValuesToPayload,
  mistoEnrichmentToFormValues,
  mistoFormValuesToPayload,
  outroEnrichmentToFormValues,
  outroFormValuesToPayload,
  type ApsEnrichmentFormValues,
  type EnrichmentFormPayload,
  type MacEnrichmentFormValues,
  type MistoEnrichmentFormValues,
  type OutroEnrichmentFormValues,
  validateMistoEnrichmentForm,
} from '../../utils/enrichmentByPerfil';
import { LEITOS_KEYS } from '../../utils/enrichmentView';
import { EnrichmentForm } from './EnrichmentForm';

const LEITO_LABELS: Record<(typeof LEITOS_KEYS)[number], string> = {
  clinico: 'Clínico',
  cirurgico: 'Cirúrgico',
  obstetrico: 'Obstétrico',
  pediatrico: 'Pediátrico',
  uti: 'UTI',
};

interface EnrichmentFormByPerfilProps {
  perfil: EstabelecimentoPerfil;
  enrichment?: EstabelecimentoEnrichment;
  readOnly?: boolean;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}

function FormShell({
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

function LeitosFields({
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

function MistoEnrichmentForm({
  enrichment,
  readOnly,
  onSubmit,
}: {
  enrichment?: EnrichmentMisto;
  readOnly?: boolean;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}) {
  const [values, setValues] = useState<MistoEnrichmentFormValues>(() =>
    mistoEnrichmentToFormValues(enrichment),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(mistoEnrichmentToFormValues(enrichment));
    setErrors({});
  }, [enrichment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateMistoEnrichmentForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(mistoFormValuesToPayload(values));
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Falha ao salvar enriquecimento',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (readOnly) {
    return <p className="analytics-empty cadastro-detail-readonly-hint">Somente leitura.</p>;
  }

  return (
    <FormShell
      testId="enrichment-form-misto"
      errors={errors}
      submitting={submitting}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <LeitosFields
        values={values.leitos}
        errors={errors}
        onChange={(leitos) => setValues((current) => ({ ...current, leitos }))}
      />
      <label className="cadastro-field">
        <span>Capacidades ambulatoriais (uma por linha)</span>
        <textarea
          rows={3}
          value={values.capacidades_ambulatoriais}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              capacidades_ambulatoriais: event.target.value,
            }))
          }
        />
      </label>
      <label className="cadastro-field">
        <span>Notas MAC</span>
        <textarea
          rows={2}
          value={values.notas_mac}
          onChange={(event) =>
            setValues((current) => ({ ...current, notas_mac: event.target.value }))
          }
        />
      </label>
      <label className="cadastro-field">
        <span>Notas</span>
        <textarea
          rows={3}
          value={values.notas}
          onChange={(event) =>
            setValues((current) => ({ ...current, notas: event.target.value }))
          }
        />
      </label>
    </FormShell>
  );
}

function TextEnrichmentForm({
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
  }, [enrichment, toValues]);

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
    return <p className="analytics-empty cadastro-detail-readonly-hint">Somente leitura.</p>;
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

export function EnrichmentFormByPerfil({
  perfil,
  enrichment,
  readOnly,
  onSubmit,
}: EnrichmentFormByPerfilProps) {
  if (perfil === 'Hospitalar') {
    if (readOnly) {
      return <p className="analytics-empty cadastro-detail-readonly-hint">Somente leitura.</p>;
    }

    return (
      <EnrichmentForm
        initialEnrichment={(enrichment as EnrichmentHospitalar | undefined) ?? undefined}
        onSubmit={async (payload) => {
          await onSubmit({
            ...payload,
            leitos: payload.leitos,
          });
        }}
      />
    );
  }

  if (perfil === 'Misto') {
    return (
      <MistoEnrichmentForm
        enrichment={enrichment as EnrichmentMisto | undefined}
        readOnly={readOnly}
        onSubmit={onSubmit}
      />
    );
  }

  if (perfil === 'APS') {
    return (
      <TextEnrichmentForm
        testId="enrichment-form-aps"
        enrichment={enrichment}
        readOnly={readOnly}
        toValues={(value) =>
          ({ ...apsEnrichmentToFormValues(value as EnrichmentAps | undefined) }) as Record<
            string,
            string
          >
        }
        toPayload={(values) =>
          apsFormValuesToPayload(values as unknown as ApsEnrichmentFormValues)
        }
        fields={[
          { key: 'notas_territorio', label: 'Notas de território' },
          { key: 'cobertura_populacional', label: 'Cobertura populacional', rows: 2 },
          { key: 'vinculo_esus', label: 'Vínculo e-SUS' },
          { key: 'prioridades_planejamento', label: 'Prioridades de planejamento' },
          { key: 'notas', label: 'Notas' },
        ]}
        onSubmit={onSubmit}
      />
    );
  }

  if (perfil === 'MAC') {
    return (
      <TextEnrichmentForm
        testId="enrichment-form-mac"
        enrichment={enrichment}
        readOnly={readOnly}
        toValues={(value) =>
          ({ ...macEnrichmentToFormValues(value as EnrichmentMac | undefined) }) as Record<
            string,
            string
          >
        }
        toPayload={(values) =>
          macFormValuesToPayload(values as unknown as MacEnrichmentFormValues)
        }
        fields={[
          { key: 'capacidades', label: 'Capacidades (uma por linha)' },
          { key: 'relacionamento_referencia', label: 'Relacionamento de referência', rows: 2 },
          { key: 'autorizacoes', label: 'Autorizações', rows: 2 },
          { key: 'notas', label: 'Notas' },
        ]}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <TextEnrichmentForm
      testId="enrichment-form-outro"
      enrichment={enrichment}
      readOnly={readOnly}
      toValues={(value) =>
        ({ ...outroEnrichmentToFormValues(value as EnrichmentOutro | undefined) }) as Record<
          string,
          string
        >
      }
      toPayload={(values) =>
        outroFormValuesToPayload(values as unknown as OutroEnrichmentFormValues)
      }
      fields={[{ key: 'notas', label: 'Notas' }]}
      onSubmit={onSubmit}
    />
  );
}

export { enrichmentSectionTitle };

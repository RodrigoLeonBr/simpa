import { useEffect, useState, type FormEvent } from 'react';
import type { EnrichmentMisto } from '../../../types/cadastros';
import {
  mistoEnrichmentToFormValues,
  mistoFormValuesToPayload,
  type MistoEnrichmentFormValues,
  validateMistoEnrichmentForm,
} from '../../../utils/enrichmentByPerfil';
import {
  FormShell,
  ReadonlyFieldList,
  type EnrichmentPerfilFormProps,
} from './enrichmentShared';

export function EnrichmentMistoForm({
  enrichment,
  readOnly,
  onSubmit,
}: EnrichmentPerfilFormProps) {
  const [values, setValues] = useState<MistoEnrichmentFormValues>(() =>
    mistoEnrichmentToFormValues(enrichment as EnrichmentMisto | undefined),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(mistoEnrichmentToFormValues(enrichment as EnrichmentMisto | undefined));
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
    return (
      <ReadonlyFieldList
        testId="enrichment-form-misto-readonly"
        fields={[
          { key: 'capacidades_ambulatoriais', label: 'Capacidades ambulatoriais' },
          { key: 'notas_mac', label: 'Notas MAC' },
          { key: 'notas', label: 'Notas' },
        ]}
        values={{
          capacidades_ambulatoriais: values.capacidades_ambulatoriais,
          notas_mac: values.notas_mac,
          notas: values.notas,
        }}
      />
    );
  }

  return (
    <FormShell
      testId="enrichment-form-misto"
      errors={errors}
      submitting={submitting}
      onSubmit={(event) => void handleSubmit(event)}
    >
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

import { useEffect, useState, type FormEvent } from 'react';
import type { EnrichmentHospitalar } from '../../types/cadastros';
import {
  hospitalEnrichmentToFormValues,
  hospitalFormValuesToPayload,
  validateHospitalEnrichmentForm,
} from '../../utils/enrichmentByPerfil';
import { LEITOS_KEYS } from '../../utils/enrichmentView';

interface EnrichmentFormProps {
  initialEnrichment?: EnrichmentHospitalar;
  onSubmit: (payload: EnrichmentHospitalar) => Promise<void>;
}

const LEITO_LABELS: Record<(typeof LEITOS_KEYS)[number], string> = {
  clinico: 'Clínico',
  cirurgico: 'Cirúrgico',
  obstetrico: 'Obstétrico',
  pediatrico: 'Pediátrico',
  uti: 'UTI',
};

export function EnrichmentForm({ initialEnrichment, onSubmit }: EnrichmentFormProps) {
  const [values, setValues] = useState(() => hospitalEnrichmentToFormValues(initialEnrichment));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(hospitalEnrichmentToFormValues(initialEnrichment));
    setErrors({});
  }, [initialEnrichment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateHospitalEnrichmentForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = hospitalFormValuesToPayload(values);
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Falha ao salvar enriquecimento',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="cadastro-form cadastro-enrichment-form"
      data-testid="enrichment-form"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
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
                value={values.leitos[key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    leitos: { ...current.leitos, [key]: event.target.value },
                  }))
                }
              />
              {errors[`leitos.${key}`] ? (
                <span className="cadastro-field-error">{errors[`leitos.${key}`]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="cadastro-field">
        <span>Especialidades (uma por linha)</span>
        <textarea
          rows={3}
          value={values.especialidades}
          onChange={(event) =>
            setValues((current) => ({ ...current, especialidades: event.target.value }))
          }
        />
      </label>

      <label className="cadastro-field">
        <span>Habilitações (uma por linha)</span>
        <textarea
          rows={3}
          value={values.habilitacoes}
          onChange={(event) =>
            setValues((current) => ({ ...current, habilitacoes: event.target.value }))
          }
        />
      </label>

      <label className="cadastro-field">
        <span>Capacidade — notas</span>
        <textarea
          rows={2}
          value={values.capacidade_notas}
          onChange={(event) =>
            setValues((current) => ({ ...current, capacidade_notas: event.target.value }))
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

      {errors._form ? <p className="cadastro-form-error">{errors._form}</p> : null}

      <div className="cadastro-form-actions">
        <button type="submit" className="cadastro-btn primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar enriquecimento'}
        </button>
      </div>
    </form>
  );
}

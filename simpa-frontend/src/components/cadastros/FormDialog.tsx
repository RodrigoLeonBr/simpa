import { useEffect, useState, type FormEvent } from 'react';
import type { CadastroFieldDef } from '../../config/cadastroEntities';
import { validateCadastroForm } from '../../utils/cadastroView';
import { ModalPortal } from './ModalPortal';

export interface SelectOption {
  value: string;
  label: string;
}

interface FormDialogProps {
  open: boolean;
  title: string;
  fields: CadastroFieldDef[];
  initialValues?: Record<string, string>;
  selectOptions?: Record<string, SelectOption[]>;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

function buildInitialValues(
  fields: CadastroFieldDef[],
  initialValues?: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = initialValues?.[field.key] ?? '';
  }
  return values;
}

export function FormDialog({
  open,
  title,
  fields,
  initialValues,
  selectOptions = {},
  onClose,
  onSubmit,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues(fields, initialValues));
    setErrors({});
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when dialog opens
  }, [open, fields, initialValues]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateCadastroForm(values, fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Falha ao salvar',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="form-dialog-backdrop">
      <div
        className="cadastro-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadastro-form-title"
        data-testid="form-dialog"
      >
        <div className="cadastro-dialog-head">
          <h3 id="cadastro-form-title">{title}</h3>
          <button type="button" className="cadastro-dialog-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form className="cadastro-form" onSubmit={(event) => void handleSubmit(event)}>
          {fields.map((field) => {
            const error = errors[field.key];
            const options = selectOptions[field.key] ?? [];

            return (
              <label key={field.key} className="cadastro-field">
                <span>{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    value={values[field.key] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
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
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    className={field.mono ? 'mono' : undefined}
                  />
                )}
                {error ? <span className="cadastro-field-error">{error}</span> : null}
              </label>
            );
          })}

          {errors._form ? <p className="cadastro-form-error">{errors._form}</p> : null}

          <div className="cadastro-form-actions">
            <button type="button" className="cadastro-btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cadastro-btn primary" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </ModalPortal>
  );
}

import type { FormEvent } from 'react';
import { useState } from 'react';
import type { LeitosVigencia, LeitosVigenciaInput } from '../../../types/cadastros';
import {
  LEITOS_DETALHE_CATALOG,
  LEITOS_RESUMO_KEYS,
  LEITO_RESUMO_LABELS,
  assertDetalheConsistente,
  formatVigenciaUi,
  parseVigenciaUi,
  type LeitoResumoKey,
} from '../../../utils/leitosCatalog';

export interface LeitosVigenciaEditorProps {
  initial?: LeitosVigencia;
  submitting?: boolean;
  onSubmit: (input: LeitosVigenciaInput) => void;
  onCancel: () => void;
}

type ResumoValues = Record<LeitoResumoKey, string>;

function buildInitialResumo(initial?: LeitosVigencia): ResumoValues {
  return LEITOS_RESUMO_KEYS.reduce((acc, key) => {
    const value = initial?.leitos[key];
    acc[key] = typeof value === 'number' ? String(value) : '';
    return acc;
  }, {} as ResumoValues);
}

function buildInitialDetalhe(initial?: LeitosVigencia): Record<string, string> {
  return LEITOS_DETALHE_CATALOG.reduce((acc, item) => {
    const value = initial?.leitos_detalhe[item.codigo];
    acc[item.codigo] = typeof value === 'number' ? String(value) : '';
    return acc;
  }, {} as Record<string, string>);
}

export function LeitosVigenciaEditor({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: LeitosVigenciaEditorProps) {
  const initialUi = initial ? formatVigenciaUi(initial.vigencia_inicio, initial.vigencia_fim) : null;
  const [inicioUi, setInicioUi] = useState(initialUi?.inicio ?? '');
  const [fimUi, setFimUi] = useState(initialUi?.fim ?? '99/9999');
  const [leitos, setLeitos] = useState<ResumoValues>(() => buildInitialResumo(initial));
  const [detalhe, setDetalhe] = useState<Record<string, string>>(() => buildInitialDetalhe(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    let vigencia: { inicio: string; fim: string } | null = null;
    try {
      vigencia = parseVigenciaUi(inicioUi, fimUi);
    } catch (err) {
      nextErrors._datas = err instanceof Error ? err.message : 'Vigência inválida';
    }

    const leitosNumerico: Record<string, number> = {};
    for (const key of LEITOS_RESUMO_KEYS) {
      const raw = leitos[key];
      if (raw.trim() === '') continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        nextErrors[`leitos.${key}`] = 'Informe um número inteiro maior ou igual a zero';
        continue;
      }
      leitosNumerico[key] = value;
    }

    const detalheNumerico: Record<string, number> = {};
    for (const item of LEITOS_DETALHE_CATALOG) {
      const raw = detalhe[item.codigo];
      if (raw === undefined || raw.trim() === '') continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        nextErrors[`detalhe.${item.codigo}`] = 'Informe um número inteiro maior ou igual a zero';
        continue;
      }
      detalheNumerico[item.codigo] = value;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const consistencia = assertDetalheConsistente(leitosNumerico, detalheNumerico);
    if (consistencia) {
      setErrors({ _consistencia: consistencia });
      return;
    }

    setErrors({});
    onSubmit({
      vigencia_inicio: vigencia!.inicio,
      vigencia_fim: vigencia!.fim,
      leitos: leitosNumerico,
      leitos_detalhe: detalheNumerico,
    });
  }

  return (
    <form
      className="cadastro-form"
      data-testid="leitos-vigencia-editor"
      noValidate
      onSubmit={handleSubmit}
    >
      <label className="cadastro-field">
        <span>Vigência início</span>
        <input
          type="text"
          placeholder="MM/AAAA"
          value={inicioUi}
          onChange={(event) => setInicioUi(event.target.value)}
        />
      </label>
      <label className="cadastro-field">
        <span>Vigência fim</span>
        <input
          type="text"
          placeholder="MM/AAAA ou 99/9999"
          value={fimUi}
          onChange={(event) => setFimUi(event.target.value)}
        />
      </label>
      {errors._datas ? <p className="cadastro-field-error">{errors._datas}</p> : null}

      <fieldset className="cadastro-enrichment-fieldset">
        <legend>Leitos (resumo)</legend>
        <div className="cadastro-enrichment-leitos">
          {LEITOS_RESUMO_KEYS.map((key) => (
            <label key={key} className="cadastro-field">
              <span>{LEITO_RESUMO_LABELS[key]}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={leitos[key]}
                onChange={(event) =>
                  setLeitos((current) => ({ ...current, [key]: event.target.value }))
                }
              />
              {errors[`leitos.${key}`] ? (
                <span className="cadastro-field-error">{errors[`leitos.${key}`]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="cadastro-enrichment-fieldset">
        <legend>Detalhamento (opcional)</legend>
        <div className="cadastro-enrichment-leitos">
          {LEITOS_DETALHE_CATALOG.map((item) => (
            <label key={item.codigo} className="cadastro-field">
              <span>{`${item.codigo} - ${item.descricao}`}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={detalhe[item.codigo]}
                onChange={(event) =>
                  setDetalhe((current) => ({ ...current, [item.codigo]: event.target.value }))
                }
              />
              {errors[`detalhe.${item.codigo}`] ? (
                <span className="cadastro-field-error">{errors[`detalhe.${item.codigo}`]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      {errors._consistencia ? <p className="cadastro-form-error">{errors._consistencia}</p> : null}

      <div className="cadastro-form-actions">
        <button type="submit" className="cadastro-btn primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar vigência'}
        </button>
        <button type="button" className="cadastro-btn" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

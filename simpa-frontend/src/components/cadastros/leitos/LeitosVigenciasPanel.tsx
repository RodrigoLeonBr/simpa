import { useState } from 'react';
import {
  createLeitosVigencia,
  deleteLeitosVigencia,
  updateLeitosVigencia,
} from '../../../api/cadastros';
import type { LeitosVigencia, LeitosVigenciaInput } from '../../../types/cadastros';
import { LEITO_RESUMO_LABELS, formatVigenciaUi } from '../../../utils/leitosCatalog';
import { LeitosVigenciaEditor } from './LeitosVigenciaEditor';

export interface LeitosVigenciasPanelProps {
  estabelecimentoId: number;
  vigencias: LeitosVigencia[];
  readOnly?: boolean;
  onChanged: () => void;
}

type Mode = { type: 'list' } | { type: 'new' } | { type: 'edit'; vigencia: LeitosVigencia };

function resumoTexto(vigencia: LeitosVigencia): string {
  return Object.entries(vigencia.leitos)
    .filter(([, valor]) => Number(valor) > 0)
    .map(([key, valor]) => `${LEITO_RESUMO_LABELS[key as keyof typeof LEITO_RESUMO_LABELS] ?? key}: ${valor}`)
    .join(', ');
}

export function LeitosVigenciasPanel({
  estabelecimentoId,
  vigencias,
  readOnly,
  onChanged,
}: LeitosVigenciasPanelProps) {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: LeitosVigenciaInput) {
    setSubmitting(true);
    setError(null);
    try {
      if (mode.type === 'new') {
        await createLeitosVigencia(estabelecimentoId, input);
      } else if (mode.type === 'edit') {
        await updateLeitosVigencia(estabelecimentoId, mode.vigencia.id, input);
      }
      setMode({ type: 'list' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar vigência');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(vigencia: LeitosVigencia) {
    setError(null);
    try {
      await deleteLeitosVigencia(estabelecimentoId, vigencia.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir vigência');
    }
  }

  if (mode.type !== 'list') {
    return (
      <div className="cadastro-enrichment-fieldset">
        <h3>Leitos por vigência</h3>
        <LeitosVigenciaEditor
          initial={mode.type === 'edit' ? mode.vigencia : undefined}
          submitting={submitting}
          onCancel={() => setMode({ type: 'list' })}
          onSubmit={(input) => void handleSubmit(input)}
        />
        {error ? <p className="cadastro-form-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="cadastro-enrichment-fieldset">
      <h3>Leitos por vigência</h3>
      {vigencias.length === 0 ? (
        <p>Nenhuma vigência cadastrada.</p>
      ) : (
        <ul>
          {vigencias.map((vigencia) => {
            const periodo = formatVigenciaUi(vigencia.vigencia_inicio, vigencia.vigencia_fim);
            return (
              <li key={vigencia.id}>
                <span>
                  {periodo.inicio} – {periodo.fim}
                </span>
                <span>{resumoTexto(vigencia)}</span>
                {!readOnly ? (
                  <>
                    <button
                      type="button"
                      className="cadastro-btn"
                      onClick={() => setMode({ type: 'edit', vigencia })}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="cadastro-btn"
                      onClick={() => void handleDelete(vigencia)}
                    >
                      Excluir
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly ? (
        <div className="cadastro-form-actions">
          <button
            type="button"
            className="cadastro-btn primary"
            onClick={() => setMode({ type: 'new' })}
          >
            Nova vigência
          </button>
        </div>
      ) : null}
      {error ? <p className="cadastro-form-error">{error}</p> : null}
    </div>
  );
}

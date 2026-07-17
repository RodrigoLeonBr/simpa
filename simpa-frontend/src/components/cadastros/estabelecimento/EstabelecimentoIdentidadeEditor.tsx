import type { FormEvent } from 'react';
import type { Estabelecimento } from '../../../types/cadastros';

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
] as const;

interface EstabelecimentoIdentidadeEditorProps {
  estabelecimento: Estabelecimento;
  canEdit: boolean;
  nomeDraft: string;
  statusDraft: string;
  identidadeUnsaved: boolean;
  savingIdentidade: boolean;
  identidadeError: string | null;
  onNomeChange: (nome: string) => void;
  onStatusChange: (status: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function EstabelecimentoIdentidadeEditor({
  estabelecimento,
  canEdit,
  nomeDraft,
  statusDraft,
  identidadeUnsaved,
  savingIdentidade,
  identidadeError,
  onNomeChange,
  onStatusChange,
  onSubmit,
}: EstabelecimentoIdentidadeEditorProps) {
  return (
    <section className="cadastro-detail-section">
      <h4>Nome e status</h4>
      {canEdit ? (
        <form
          className="cadastro-form cadastro-identidade-form"
          data-testid="estabelecimento-identidade-form"
          onSubmit={onSubmit}
        >
          <label className="cadastro-field">
            <span>Nome</span>
            <input
              type="text"
              value={nomeDraft}
              maxLength={200}
              data-testid="estabelecimento-nome-input"
              onChange={(event) => onNomeChange(event.target.value)}
            />
          </label>
          <label className="cadastro-field">
            <span>Status</span>
            <select
              value={statusDraft}
              data-testid="estabelecimento-status-select"
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {estabelecimento.nome_editado ? (
            <p className="cadastro-detail-hint">Nome editado manualmente — preservado no sync SIA.</p>
          ) : null}
          {estabelecimento.status_editado ? (
            <p className="cadastro-detail-hint">Status editado manualmente — preservado no sync SIA.</p>
          ) : null}
          {identidadeError ? <p className="cadastro-form-error">{identidadeError}</p> : null}
          <div className="cadastro-form-actions">
            <button
              type="submit"
              className="cadastro-btn primary"
              disabled={savingIdentidade || !identidadeUnsaved}
            >
              {savingIdentidade ? 'Salvando…' : 'Salvar nome e status'}
            </button>
          </div>
        </form>
      ) : (
        <div className="cadastro-detail-grid">
          <label className="cadastro-field cadastro-field-locked">
            <span>Nome</span>
            <input type="text" disabled readOnly value={estabelecimento.nome} data-testid="estabelecimento-nome-readonly" />
          </label>
          <label className="cadastro-field cadastro-field-locked">
            <span>Status</span>
            <input type="text" disabled readOnly value={estabelecimento.status} data-testid="estabelecimento-status-readonly" />
          </label>
        </div>
      )}
    </section>
  );
}

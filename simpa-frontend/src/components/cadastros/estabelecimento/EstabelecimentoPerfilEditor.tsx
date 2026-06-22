import type { FormEvent } from 'react';
import type { Estabelecimento, EstabelecimentoPerfil } from '../../../types/cadastros';
import { ESTABELECIMENTO_PERFIS } from '../../../utils/enrichmentByPerfil';

interface EstabelecimentoPerfilEditorProps {
  estabelecimento: Estabelecimento;
  canEdit: boolean;
  perfilDraft: EstabelecimentoPerfil;
  perfilUnsaved: boolean;
  savingPerfil: boolean;
  perfilError: string | null;
  onPerfilChange: (perfil: EstabelecimentoPerfil) => void;
  onSubmit: (event: FormEvent) => void;
}

function isEstabelecimentoPerfil(value: string): value is EstabelecimentoPerfil {
  return ESTABELECIMENTO_PERFIS.includes(value as EstabelecimentoPerfil);
}

export function EstabelecimentoPerfilEditor({
  estabelecimento,
  canEdit,
  perfilDraft,
  perfilUnsaved,
  savingPerfil,
  perfilError,
  onPerfilChange,
  onSubmit,
}: EstabelecimentoPerfilEditorProps) {
  return (
    <section className="cadastro-detail-section">
      <h4>Perfil operacional</h4>
      {canEdit ? (
        <form
          className="cadastro-form cadastro-perfil-form"
          data-testid="estabelecimento-perfil-form"
          onSubmit={onSubmit}
        >
          <label className="cadastro-field">
            <span>Perfil</span>
            <select
              value={perfilDraft}
              data-testid="estabelecimento-perfil-select"
              onChange={(event) => {
                const next = event.target.value;
                if (isEstabelecimentoPerfil(next)) {
                  onPerfilChange(next);
                }
              }}
            >
              {ESTABELECIMENTO_PERFIS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {estabelecimento.perfil_editado ? (
            <p className="cadastro-detail-hint">Perfil editado manualmente.</p>
          ) : null}
          {perfilUnsaved ? (
            <p className="cadastro-detail-hint">Salve o perfil antes de editar o enriquecimento.</p>
          ) : null}
          {perfilError ? <p className="cadastro-form-error">{perfilError}</p> : null}
          <div className="cadastro-form-actions">
            <button
              type="submit"
              className="cadastro-btn primary"
              disabled={savingPerfil || perfilDraft === estabelecimento.perfil}
            >
              {savingPerfil ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      ) : (
        <label className="cadastro-field cadastro-field-locked">
          <span>Perfil</span>
          <input
            type="text"
            disabled
            readOnly
            value={estabelecimento.perfil}
            data-testid="estabelecimento-perfil-readonly"
          />
        </label>
      )}
    </section>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { updateEnrichmentBySlug, updatePerfil } from '../../api/cadastros';
import {
  EnrichmentFormByPerfil,
  enrichmentSectionTitle,
} from '../../components/cadastros/EnrichmentFormByPerfil';
import { ModalPortal } from '../../components/cadastros/ModalPortal';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { Estabelecimento, EstabelecimentoPerfil } from '../../types/cadastros';
import { canEditCadastrosEstabelecimento } from '../../utils/adminView';
import { formatCadastroCell, formatCadastroStatus } from '../../utils/cadastroView';
import {
  enrichmentSlugForPerfil,
  ESTABELECIMENTO_PERFIS,
  resolveEstabelecimentoEnrichment,
} from '../../utils/enrichmentByPerfil';
import { canEditEnrichment, formatLeitosSummary } from '../../utils/enrichmentView';
import { formatImportDate } from '../../utils/importacaoView';

interface EstabelecimentoDetailDrawerProps {
  estabelecimento: Estabelecimento;
  onClose: () => void;
  onSaved: (updated: Estabelecimento) => void;
}

interface EstabelecimentosPageShellProps {
  children: ReactNode;
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <label className="cadastro-field cadastro-field-locked">
      <span>
        {label} <span aria-hidden="true">🔒</span>
      </span>
      <input
        type="text"
        disabled
        readOnly
        value={value}
        title="Sincronizado do SIA — somente leitura"
        data-testid={`locked-field-${label.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </label>
  );
}

export function EstabelecimentoDetailDrawer({
  estabelecimento,
  onClose,
  onSaved,
}: EstabelecimentoDetailDrawerProps) {
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const canEdit = canEditCadastrosEstabelecimento(user?.perfil);
  const [perfilDraft, setPerfilDraft] = useState<EstabelecimentoPerfil>(estabelecimento.perfil);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilError, setPerfilError] = useState<string | null>(null);

  const enrichment = resolveEstabelecimentoEnrichment(estabelecimento);
  const showEnrichment = canEditEnrichment(estabelecimento.perfil, canEdit);
  const leitosSummary =
    estabelecimento.perfil === 'Hospitalar' || estabelecimento.perfil === 'Misto'
      ? formatLeitosSummary(
          (enrichment as { leitos?: Record<string, number> } | undefined)?.leitos,
        )
      : null;

  useEffect(() => {
    setPerfilDraft(estabelecimento.perfil);
    setPerfilError(null);
  }, [estabelecimento.id, estabelecimento.perfil]);

  async function handlePerfilSave(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || perfilDraft === estabelecimento.perfil) return;

    setSavingPerfil(true);
    setPerfilError(null);
    try {
      const updated = await updatePerfil(estabelecimento.id, perfilDraft);
      onSaved(updated);
      showToast('Perfil atualizado');
    } catch (err) {
      setPerfilError(err instanceof Error ? err.message : 'Falha ao salvar perfil');
    } finally {
      setSavingPerfil(false);
    }
  }

  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="estabelecimento-drawer-backdrop">
        <div
          className="cadastro-dialog card cadastro-detail-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estabelecimento-detail-title"
          data-testid="estabelecimento-detail-drawer"
        >
          <div className="cadastro-dialog-head">
            <h3 id="estabelecimento-detail-title">{estabelecimento.nome}</h3>
            <button
              type="button"
              className="cadastro-dialog-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="cadastro-detail-body">
            <section className="cadastro-detail-section">
              <h4>Dados sincronizados (SIA)</h4>
              <div className="cadastro-detail-grid">
                <LockedField label="Código externo" value={estabelecimento.codigo_externo} />
                <LockedField label="Nome" value={estabelecimento.nome} />
                <LockedField label="CNPJ" value={formatCadastroCell(estabelecimento.cnpj)} />
                <LockedField label="RE tipo" value={formatCadastroCell(estabelecimento.re_tipo)} />
                <LockedField label="Tipo unidade" value={formatCadastroCell(estabelecimento.tipouni)} />
                <LockedField label="Status" value={formatCadastroStatus(estabelecimento.status)} />
                <LockedField
                  label="Sincronizado em"
                  value={
                    estabelecimento.sincronizado_em
                      ? formatImportDate(estabelecimento.sincronizado_em)
                      : '—'
                  }
                />
              </div>
            </section>

            <section className="cadastro-detail-section">
              <h4>Perfil operacional</h4>
              {canEdit ? (
                <form
                  className="cadastro-form cadastro-perfil-form"
                  data-testid="estabelecimento-perfil-form"
                  onSubmit={(event) => void handlePerfilSave(event)}
                >
                  <label className="cadastro-field">
                    <span>Perfil</span>
                    <select
                      value={perfilDraft}
                      data-testid="estabelecimento-perfil-select"
                      onChange={(event) =>
                        setPerfilDraft(event.target.value as EstabelecimentoPerfil)
                      }
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

            {showEnrichment ? (
              <section className="cadastro-detail-section">
                <h4>{enrichmentSectionTitle(estabelecimento.perfil)}</h4>
                {leitosSummary ? (
                  <p className="cadastro-detail-hint">Leitos atuais: {leitosSummary}</p>
                ) : null}
                <EnrichmentFormByPerfil
                  perfil={estabelecimento.perfil}
                  enrichment={enrichment}
                  readOnly={!canEdit}
                  onSubmit={async (payload) => {
                    const slug = enrichmentSlugForPerfil(estabelecimento.perfil);
                    const updated = await updateEnrichmentBySlug(
                      estabelecimento.id,
                      slug,
                      payload,
                    );
                    onSaved(updated);
                    showToast('Enriquecimento salvo');
                  }}
                />
              </section>
            ) : (
              <p className="analytics-empty cadastro-detail-readonly-hint">
                Enriquecimento não disponível para este perfil ou sem permissão de edição.
              </p>
            )}
          </div>

          <ToastBanner message={toast.message} visible={toast.visible} />
        </div>
      </div>
    </ModalPortal>
  );
}

export function EstabelecimentosPageShell({ children }: EstabelecimentosPageShellProps) {
  return (
    <div className="cadastro-page simpa-rise" data-testid="estabelecimentos-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Estabelecimentos</h2>
          <p className="analytics-subtitle">
            Espelho unificado de prestadores — campos SIA bloqueados; perfil e enriquecimento
            editáveis para equipe de planejamento.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

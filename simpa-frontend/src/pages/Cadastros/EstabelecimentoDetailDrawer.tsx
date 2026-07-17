import { useEffect, useState, type FormEvent } from 'react';
import { updateEnrichmentBySlug, updateIdentidade, updatePerfil } from '../../api/cadastros';
import { EstabelecimentoDrawerChrome } from '../../components/cadastros/estabelecimento/EstabelecimentoDrawerChrome';
import { EstabelecimentoIdentidadeEditor } from '../../components/cadastros/estabelecimento/EstabelecimentoIdentidadeEditor';
import {
  EstabelecimentoEnrichmentPanel,
  resolveLeitosSummary,
} from '../../components/cadastros/estabelecimento/EstabelecimentoEnrichmentPanel';
import { EstabelecimentoPerfilEditor } from '../../components/cadastros/estabelecimento/EstabelecimentoPerfilEditor';
import { EstabelecimentoSyncedSection } from '../../components/cadastros/estabelecimento/EstabelecimentoSyncedSection';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { Estabelecimento, EstabelecimentoPerfil } from '../../types/cadastros';
import { canEditCadastrosEstabelecimento } from '../../utils/adminView';
import {
  enrichmentSlugForPerfil,
  resolveEstabelecimentoEnrichment,
} from '../../utils/enrichmentByPerfil';
import { canEditEnrichment, canViewEnrichment } from '../../utils/enrichmentView';
import { canEditImportMappings } from '../../utils/importacaoView';

interface EstabelecimentoDetailDrawerProps {
  estabelecimento: Estabelecimento;
  onClose: () => void;
  onSaved: (updated: Estabelecimento) => void;
}

export function EstabelecimentoDetailDrawer({
  estabelecimento,
  onClose,
  onSaved,
}: EstabelecimentoDetailDrawerProps) {
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const canEdit = canEditCadastrosEstabelecimento(user?.perfil);
  const canManageImportMappings = canEditImportMappings(user?.perfil);
  const [perfilDraft, setPerfilDraft] = useState<EstabelecimentoPerfil>(estabelecimento.perfil);
  const [nomeDraft, setNomeDraft] = useState(estabelecimento.nome);
  const [statusDraft, setStatusDraft] = useState(estabelecimento.status);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingIdentidade, setSavingIdentidade] = useState(false);
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const [identidadeError, setIdentidadeError] = useState<string | null>(null);

  const perfilUnsaved = perfilDraft !== estabelecimento.perfil;
  const identidadeUnsaved =
    nomeDraft.trim() !== estabelecimento.nome || statusDraft !== estabelecimento.status;
  const enrichmentPerfil = perfilDraft;
  const enrichment =
    perfilUnsaved ? undefined : resolveEstabelecimentoEnrichment(estabelecimento);
  const showEnrichment = canViewEnrichment(enrichmentPerfil);
  const canEditEnrichmentForm =
    canEditEnrichment(enrichmentPerfil, canEdit) && !perfilUnsaved;
  const leitosSummary = resolveLeitosSummary(enrichmentPerfil, enrichment);

  useEffect(() => {
    setPerfilDraft(estabelecimento.perfil);
    setNomeDraft(estabelecimento.nome);
    setStatusDraft(estabelecimento.status);
    setPerfilError(null);
    setIdentidadeError(null);
  }, [estabelecimento.id, estabelecimento.perfil, estabelecimento.nome, estabelecimento.status]);

  async function handleIdentidadeSave(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !identidadeUnsaved) return;

    const payload: { nome?: string; status?: string } = {};
    if (nomeDraft.trim() !== estabelecimento.nome) {
      payload.nome = nomeDraft.trim();
    }
    if (statusDraft !== estabelecimento.status) {
      payload.status = statusDraft;
    }
    if (!payload.nome && !payload.status) return;

    setSavingIdentidade(true);
    setIdentidadeError(null);
    try {
      const updated = await updateIdentidade(estabelecimento.id, payload);
      onSaved(updated);
      showToast('Nome e status atualizados');
    } catch (err) {
      setIdentidadeError(err instanceof Error ? err.message : 'Falha ao salvar identidade');
    } finally {
      setSavingIdentidade(false);
    }
  }

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
    <EstabelecimentoDrawerChrome
      title={estabelecimento.nome}
      onClose={onClose}
      toastMessage={toast.message}
      toastVisible={toast.visible}
    >
      <EstabelecimentoSyncedSection
        estabelecimento={estabelecimento}
        showImportMappingsLink={canManageImportMappings}
      />
      <EstabelecimentoIdentidadeEditor
        estabelecimento={estabelecimento}
        canEdit={canEdit}
        nomeDraft={nomeDraft}
        statusDraft={statusDraft}
        identidadeUnsaved={identidadeUnsaved}
        savingIdentidade={savingIdentidade}
        identidadeError={identidadeError}
        onNomeChange={setNomeDraft}
        onStatusChange={setStatusDraft}
        onSubmit={(event) => void handleIdentidadeSave(event)}
      />
      <EstabelecimentoPerfilEditor
        estabelecimento={estabelecimento}
        canEdit={canEdit}
        perfilDraft={perfilDraft}
        perfilUnsaved={perfilUnsaved}
        savingPerfil={savingPerfil}
        perfilError={perfilError}
        onPerfilChange={setPerfilDraft}
        onSubmit={(event) => void handlePerfilSave(event)}
      />
      <EstabelecimentoEnrichmentPanel
        perfil={enrichmentPerfil}
        enrichment={enrichment}
        showEnrichment={showEnrichment}
        canEditEnrichmentForm={canEditEnrichmentForm}
        leitosSummary={leitosSummary}
        onSubmit={async (payload) => {
          const slug = enrichmentSlugForPerfil(enrichmentPerfil);
          const updated = await updateEnrichmentBySlug(estabelecimento.id, slug, payload);
          onSaved(updated);
          showToast('Enriquecimento salvo');
        }}
      />
    </EstabelecimentoDrawerChrome>
  );
}

import { EnrichmentFormByPerfil, enrichmentSectionTitle } from '../EnrichmentFormByPerfil';
import type { EnrichmentFormPayload } from '../../../utils/enrichmentByPerfil';
import type { EstabelecimentoEnrichment, EstabelecimentoPerfil } from '../../../types/cadastros';
import { formatLeitosSummary } from '../../../utils/enrichmentView';

interface EstabelecimentoEnrichmentPanelProps {
  perfil: EstabelecimentoPerfil;
  enrichment: EstabelecimentoEnrichment | undefined;
  showEnrichment: boolean;
  canEditEnrichmentForm: boolean;
  leitosSummary: string | null;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}

export function EstabelecimentoEnrichmentPanel({
  perfil,
  enrichment,
  showEnrichment,
  canEditEnrichmentForm,
  leitosSummary,
  onSubmit,
}: EstabelecimentoEnrichmentPanelProps) {
  if (!showEnrichment) {
    return (
      <p className="analytics-empty cadastro-detail-readonly-hint">
        Enriquecimento não disponível para este perfil.
      </p>
    );
  }

  return (
    <section className="cadastro-detail-section">
      <h4>{enrichmentSectionTitle(perfil)}</h4>
      {leitosSummary ? <p className="cadastro-detail-hint">Leitos atuais: {leitosSummary}</p> : null}
      <EnrichmentFormByPerfil
        perfil={perfil}
        enrichment={enrichment}
        readOnly={!canEditEnrichmentForm}
        onSubmit={onSubmit}
      />
    </section>
  );
}

export function resolveLeitosSummary(
  perfil: EstabelecimentoPerfil,
  enrichment: EstabelecimentoEnrichment | undefined,
): string | null {
  if (perfil !== 'Hospitalar' && perfil !== 'Misto') {
    return null;
  }
  return formatLeitosSummary((enrichment as { leitos?: Record<string, number> } | undefined)?.leitos);
}

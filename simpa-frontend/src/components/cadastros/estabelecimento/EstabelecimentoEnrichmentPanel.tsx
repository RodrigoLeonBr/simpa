import { LeitosVigenciasPanel } from '../leitos/LeitosVigenciasPanel';
import { EnrichmentFormByPerfil, enrichmentSectionTitle } from '../EnrichmentFormByPerfil';
import type { EnrichmentFormPayload } from '../../../utils/enrichmentByPerfil';
import type {
  EstabelecimentoEnrichment,
  EstabelecimentoPerfil,
  LeitosVigencia,
} from '../../../types/cadastros';
import { formatLeitosSummary } from '../../../utils/enrichmentView';

interface EstabelecimentoEnrichmentPanelProps {
  perfil: EstabelecimentoPerfil;
  enrichment: EstabelecimentoEnrichment | undefined;
  showEnrichment: boolean;
  canEditEnrichmentForm: boolean;
  leitosSummary: string | null;
  estabelecimentoId: number;
  leitosVigencias: LeitosVigencia[];
  onVigenciasChanged: () => void;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}

export function EstabelecimentoEnrichmentPanel({
  perfil,
  enrichment,
  showEnrichment,
  canEditEnrichmentForm,
  leitosSummary,
  estabelecimentoId,
  leitosVigencias,
  onVigenciasChanged,
  onSubmit,
}: EstabelecimentoEnrichmentPanelProps) {
  if (!showEnrichment) {
    return (
      <p className="analytics-empty cadastro-detail-readonly-hint">
        Enriquecimento não disponível para este perfil.
      </p>
    );
  }

  const showLeitosVigencias = perfil === 'Hospitalar' || perfil === 'Misto';

  return (
    <section className="cadastro-detail-section">
      <h4>{enrichmentSectionTitle(perfil)}</h4>
      {leitosSummary ? <p className="cadastro-detail-hint">Leitos atuais: {leitosSummary}</p> : null}
      {showLeitosVigencias ? (
        <LeitosVigenciasPanel
          estabelecimentoId={estabelecimentoId}
          vigencias={leitosVigencias}
          readOnly={!canEditEnrichmentForm}
          onChanged={onVigenciasChanged}
        />
      ) : null}
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

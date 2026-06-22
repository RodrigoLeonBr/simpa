import type { EnrichmentAps } from '../../../types/cadastros';
import {
  apsEnrichmentToFormValues,
  apsFormValuesToPayload,
  type ApsEnrichmentFormValues,
} from '../../../utils/enrichmentByPerfil';
import { type EnrichmentPerfilFormProps, TextEnrichmentForm } from './enrichmentShared';

const APS_FIELDS = [
  { key: 'notas_territorio', label: 'Notas de território' },
  { key: 'cobertura_populacional', label: 'Cobertura populacional', rows: 2 },
  { key: 'vinculo_esus', label: 'Vínculo e-SUS' },
  { key: 'prioridades_planejamento', label: 'Prioridades de planejamento' },
  { key: 'notas', label: 'Notas' },
] as const;

export function EnrichmentApsForm({ enrichment, readOnly, onSubmit }: EnrichmentPerfilFormProps) {
  return (
    <TextEnrichmentForm
      testId="enrichment-form-aps"
      enrichment={enrichment}
      readOnly={readOnly}
      toValues={(value) =>
        ({ ...apsEnrichmentToFormValues(value as EnrichmentAps | undefined) }) as Record<
          string,
          string
        >
      }
      toPayload={(values) => apsFormValuesToPayload(values as unknown as ApsEnrichmentFormValues)}
      fields={[...APS_FIELDS]}
      onSubmit={onSubmit}
    />
  );
}

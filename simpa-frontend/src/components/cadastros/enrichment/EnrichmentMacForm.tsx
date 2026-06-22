import type { EnrichmentMac } from '../../../types/cadastros';
import {
  macEnrichmentToFormValues,
  macFormValuesToPayload,
  type MacEnrichmentFormValues,
} from '../../../utils/enrichmentByPerfil';
import { type EnrichmentPerfilFormProps, TextEnrichmentForm } from './enrichmentShared';

const MAC_FIELDS = [
  { key: 'capacidades', label: 'Capacidades (uma por linha)' },
  { key: 'relacionamento_referencia', label: 'Relacionamento de referência', rows: 2 },
  { key: 'autorizacoes', label: 'Autorizações', rows: 2 },
  { key: 'notas', label: 'Notas' },
] as const;

export function EnrichmentMacForm({ enrichment, readOnly, onSubmit }: EnrichmentPerfilFormProps) {
  return (
    <TextEnrichmentForm
      testId="enrichment-form-mac"
      enrichment={enrichment}
      readOnly={readOnly}
      toValues={(value) =>
        ({ ...macEnrichmentToFormValues(value as EnrichmentMac | undefined) }) as Record<
          string,
          string
        >
      }
      toPayload={(values) => macFormValuesToPayload(values as unknown as MacEnrichmentFormValues)}
      fields={[...MAC_FIELDS]}
      onSubmit={onSubmit}
    />
  );
}

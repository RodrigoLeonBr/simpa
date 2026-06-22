import type { EnrichmentOutro } from '../../../types/cadastros';
import {
  outroEnrichmentToFormValues,
  outroFormValuesToPayload,
  type OutroEnrichmentFormValues,
} from '../../../utils/enrichmentByPerfil';
import { type EnrichmentPerfilFormProps, TextEnrichmentForm } from './enrichmentShared';

export function EnrichmentOutroForm({ enrichment, readOnly, onSubmit }: EnrichmentPerfilFormProps) {
  return (
    <TextEnrichmentForm
      testId="enrichment-form-outro"
      enrichment={enrichment}
      readOnly={readOnly}
      toValues={(value) =>
        ({ ...outroEnrichmentToFormValues(value as EnrichmentOutro | undefined) }) as Record<
          string,
          string
        >
      }
      toPayload={(values) =>
        outroFormValuesToPayload(values as unknown as OutroEnrichmentFormValues)
      }
      fields={[{ key: 'notas', label: 'Notas' }]}
      onSubmit={onSubmit}
    />
  );
}

import type { EnrichmentHospitalar } from '../../../types/cadastros';
import { hospitalEnrichmentToFormValues } from '../../../utils/enrichmentByPerfil';
import { LEITOS_KEYS } from '../../../utils/enrichmentView';
import { EnrichmentForm } from '../EnrichmentForm';
import {
  LEITO_LABELS,
  type EnrichmentPerfilFormProps,
  ReadonlyFieldList,
} from './enrichmentShared';

export function EnrichmentHospitalarForm({
  enrichment,
  readOnly,
  onSubmit,
}: EnrichmentPerfilFormProps) {
  if (readOnly) {
    const values = hospitalEnrichmentToFormValues(
      (enrichment as EnrichmentHospitalar | undefined) ?? undefined,
    );
    return (
      <ReadonlyFieldList
        testId="enrichment-form-readonly"
        fields={[
          ...LEITOS_KEYS.map((key) => ({ key, label: LEITO_LABELS[key] })),
          { key: 'especialidades', label: 'Especialidades' },
          { key: 'habilitacoes', label: 'Habilitações' },
          { key: 'notas', label: 'Notas' },
        ]}
        values={{
          ...values.leitos,
          especialidades: values.especialidades,
          habilitacoes: values.habilitacoes,
          notas: values.notas,
        }}
      />
    );
  }

  return (
    <EnrichmentForm
      initialEnrichment={(enrichment as EnrichmentHospitalar | undefined) ?? undefined}
      onSubmit={async (payload) => {
        await onSubmit({
          ...payload,
          leitos: payload.leitos,
        });
      }}
    />
  );
}

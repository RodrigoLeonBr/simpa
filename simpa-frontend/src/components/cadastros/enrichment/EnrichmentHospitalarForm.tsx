import type { EnrichmentHospitalar } from '../../../types/cadastros';
import { hospitalEnrichmentToFormValues } from '../../../utils/enrichmentByPerfil';
import { EnrichmentForm } from '../EnrichmentForm';
import { type EnrichmentPerfilFormProps, ReadonlyFieldList } from './enrichmentShared';

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
          { key: 'especialidades', label: 'Especialidades' },
          { key: 'habilitacoes', label: 'Habilitações' },
          { key: 'notas', label: 'Notas' },
        ]}
        values={{
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
      onSubmit={onSubmit}
    />
  );
}

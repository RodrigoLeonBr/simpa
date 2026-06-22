import type { ComponentType } from 'react';
import type {
  EstabelecimentoEnrichment,
  EstabelecimentoPerfil,
} from '../../types/cadastros';
import {
  enrichmentSectionTitle,
  type EnrichmentFormPayload,
} from '../../utils/enrichmentByPerfil';
import { EnrichmentApsForm } from './enrichment/EnrichmentApsForm';
import { EnrichmentHospitalarForm } from './enrichment/EnrichmentHospitalarForm';
import { EnrichmentMacForm } from './enrichment/EnrichmentMacForm';
import { EnrichmentMistoForm } from './enrichment/EnrichmentMistoForm';
import { EnrichmentOutroForm } from './enrichment/EnrichmentOutroForm';
import type { EnrichmentPerfilFormProps } from './enrichment/enrichmentShared';

interface EnrichmentFormByPerfilProps {
  perfil: EstabelecimentoPerfil;
  enrichment?: EstabelecimentoEnrichment;
  readOnly?: boolean;
  onSubmit: (payload: EnrichmentFormPayload) => Promise<void>;
}

const PERFIL_FORMS: Record<
  EstabelecimentoPerfil,
  ComponentType<EnrichmentPerfilFormProps>
> = {
  APS: EnrichmentApsForm,
  MAC: EnrichmentMacForm,
  Hospitalar: EnrichmentHospitalarForm,
  Misto: EnrichmentMistoForm,
  Outro: EnrichmentOutroForm,
};

export function EnrichmentFormByPerfil({
  perfil,
  enrichment,
  readOnly,
  onSubmit,
}: EnrichmentFormByPerfilProps) {
  const FormComponent = PERFIL_FORMS[perfil] ?? EnrichmentOutroForm;
  return (
    <FormComponent enrichment={enrichment} readOnly={readOnly} onSubmit={onSubmit} />
  );
}

export { enrichmentSectionTitle };

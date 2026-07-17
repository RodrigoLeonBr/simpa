import { PLANNING_STAFF_PERFIS } from '../adminView';

export const PLANNING_IMPORT_PERFIS = PLANNING_STAFF_PERFIS;

export function canEditImportMappings(perfil: string | undefined): boolean {
  return PLANNING_IMPORT_PERFIS.includes(
    (perfil ?? '') as (typeof PLANNING_IMPORT_PERFIS)[number],
  );
}

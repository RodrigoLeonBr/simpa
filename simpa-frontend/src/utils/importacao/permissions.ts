export const PLANNING_IMPORT_PERFIS = [
  'Administrador',
  'Gestor Secretaria',
  'Planejamento',
] as const;

export function canEditImportMappings(perfil: string | undefined): boolean {
  return PLANNING_IMPORT_PERFIS.includes(
    (perfil ?? '') as (typeof PLANNING_IMPORT_PERFIS)[number],
  );
}

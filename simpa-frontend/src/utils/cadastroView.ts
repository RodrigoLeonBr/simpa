import type { CadastroFieldDef } from '../config/cadastroEntities';

export function validateCadastroForm(
  values: Record<string, string>,
  fields: CadastroFieldDef[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!field.required) continue;

    const value = values[field.key]?.trim() ?? '';
    if (!value) {
      errors[field.key] = `${field.label} é obrigatório`;
    }
  }

  return errors;
}

export function formatCadastroStatus(status: string | undefined): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatCadastroCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

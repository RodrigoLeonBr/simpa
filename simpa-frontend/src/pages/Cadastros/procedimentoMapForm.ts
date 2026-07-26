/** Pure helpers for Cadastros Procedimentos (e-SUS ↔ SIGTAP) form. */

export const HELP_SILENT_SKIP =
  'Labels e-SUS sem mapeamento ativo são omitidos no export e na consolidação (silent skip) — não geram erro.';

export const HELP_PURPOSE =
  'Catálogo de-para: associa o texto exato da seção/descrição do relatório e-SUS a um código SIGTAP oficial.';

export const HELP_REQUIRED =
  'Campos obrigatórios: seção, descrição e-SUS e código SIGTAP (ou procedimento já cadastrado).';

export interface MapFormState {
  secao: string;
  descricao_esus: string;
  codigo_sigtap: string;
  descricao: string;
  origem: string;
}

export function emptyMapForm(): MapFormState {
  return {
    secao: '',
    descricao_esus: '',
    codigo_sigtap: '',
    descricao: '',
    origem: 'manual',
  };
}

/** Returns error message or null if valid. */
export function validateMapForm(form: MapFormState): string | null {
  if (!form.secao.trim() || !form.descricao_esus.trim()) {
    return 'secao e descricao_esus são obrigatórios';
  }
  if (!form.codigo_sigtap.trim()) {
    return 'codigo_sigtap é obrigatório';
  }
  return null;
}

export function buildCreateMapBody(form: MapFormState) {
  const body: Record<string, string> = {
    secao: form.secao.trim(),
    descricao_esus: form.descricao_esus.trim(),
    codigo_sigtap: form.codigo_sigtap.replace(/\D/g, ''),
    origem: form.origem || 'manual',
  };
  if (form.descricao.trim()) body.descricao = form.descricao.trim();
  return body;
}

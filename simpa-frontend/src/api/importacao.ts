import type { CargaEsus } from '../types/contrato';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchCargas(filtros?: { competencia?: string; unidade?: string }) {
  const params = new URLSearchParams();
  if (filtros?.competencia) params.set('competencia', filtros.competencia);
  if (filtros?.unidade)     params.set('unidade', filtros.unidade);
  const res = await fetch(`${BASE}/api/importacao/cargas?${params}`);
  return res.json() as Promise<CargaEsus[]>;
}

export async function previewUpload(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${BASE}/api/importacao/preview`, { method: 'POST', body: form });
  return res.json();
}

export async function uploadCargas(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${BASE}/api/importacao/upload`, { method: 'POST', body: form });
  return res.json();
}

export async function reprocessarCarga(id: number) {
  const res = await fetch(`${BASE}/api/importacao/${id}/reprocessar`, { method: 'POST' });
  return res.json();
}

export async function excluirCarga(id: number) {
  const res = await fetch(`${BASE}/api/importacao/${id}`, { method: 'DELETE' });
  return res.json();
}

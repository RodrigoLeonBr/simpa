import { apiFetch } from './client';

export interface Unidade {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  status: string;
}

export interface Equipe {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  unidade_id: number;
  status: string;
}

export function fetchUnidades(): Promise<Unidade[]> {
  return apiFetch<Unidade[]>('/api/cadastros/unidades');
}

export function fetchEquipes(unidadeId?: number): Promise<Equipe[]> {
  const query = unidadeId ? `?unidade_id=${unidadeId}` : '';
  return apiFetch<Equipe[]>(`/api/cadastros/equipes${query}`);
}

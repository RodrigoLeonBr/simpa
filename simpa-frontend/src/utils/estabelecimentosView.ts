import type {
  Estabelecimento,
  EstabelecimentoPerfil,
  EstabelecimentoPerfilFilter,
} from '../types/cadastros';
import type { Unidade } from '../types/contrato';

export function buildEstabelecimentosPerfilQuery(
  perfil: Exclude<EstabelecimentoPerfilFilter, ''> | EstabelecimentoPerfil,
): { perfil: EstabelecimentoPerfil; limit: 200 } {
  return { perfil, limit: 200 };
}

/** @deprecated Prefer `buildEstabelecimentosPerfilQuery('APS')` */
export const ESTABELECIMENTOS_APS_QUERY = buildEstabelecimentosPerfilQuery('APS');

export function mapEstabelecimentoToUnidade(est: Estabelecimento): Unidade {
  return {
    id: est.id,
    codigo: est.codigo_externo,
    nome: est.nome,
    tipo: est.perfil,
    status: est.status,
  };
}

export function mapEstabelecimentosToUnidades(items: Estabelecimento[]): Unidade[] {
  return items.map(mapEstabelecimentoToUnidade);
}

export function activeEstabelecimentos(items: Estabelecimento[]): Estabelecimento[] {
  return items.filter((item) => item.status !== 'inativo');
}

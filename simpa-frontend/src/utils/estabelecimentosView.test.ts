import { describe, expect, it } from 'vitest';
import {
  activeEstabelecimentos,
  buildEstabelecimentosPerfilQuery,
  ESTABELECIMENTOS_APS_QUERY,
  mapEstabelecimentoToUnidade,
  mapEstabelecimentosToUnidades,
} from './estabelecimentosView';

describe('estabelecimentosView', () => {
  it('buildEstabelecimentosPerfilQuery includes perfil and limit 200', () => {
    expect(buildEstabelecimentosPerfilQuery('MAC')).toEqual({
      perfil: 'MAC',
      limit: 200,
    });
    expect(buildEstabelecimentosPerfilQuery('Misto')).toEqual({
      perfil: 'Misto',
      limit: 200,
    });
  });

  it('keeps ESTABELECIMENTOS_APS_QUERY as APS alias', () => {
    expect(ESTABELECIMENTOS_APS_QUERY).toEqual(buildEstabelecimentosPerfilQuery('APS'));
  });

  it('maps estabelecimento to dashboard unidade shape', () => {
    expect(
      mapEstabelecimentoToUnidade({
        id: 1,
        codigo_externo: 'CAFI001',
        nome: 'CAFI',
        perfil: 'APS',
        perfil_editado: false,
        status: 'ativo',
      }),
    ).toEqual({
      id: 1,
      codigo: 'CAFI001',
      nome: 'CAFI',
      tipo: 'APS',
      status: 'ativo',
    });
  });

  it('filters inactive estabelecimentos', () => {
    const items = [
      {
        id: 1,
        codigo_externo: 'A',
        nome: 'A',
        perfil: 'APS' as const,
        perfil_editado: false,
        status: 'ativo',
      },
      {
        id: 2,
        codigo_externo: 'B',
        nome: 'B',
        perfil: 'APS' as const,
        perfil_editado: false,
        status: 'inativo',
      },
    ];
    expect(activeEstabelecimentos(items)).toHaveLength(1);
    expect(mapEstabelecimentosToUnidades(items)).toHaveLength(2);
  });
});

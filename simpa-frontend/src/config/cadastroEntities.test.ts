import { describe, expect, it } from 'vitest';
import {
  CADASTRO_GRID_ITEMS,
  cadastroGridTestId,
  getCadastroEntity,
} from './cadastroEntities';

describe('cadastroEntities config', () => {
  it('includes indicadores-painel grid entry', () => {
    const item = CADASTRO_GRID_ITEMS.find((entry) => entry.route === 'indicadores-painel');
    expect(item?.title).toBe('Indicadores do Painel');
  });

  it('resolves entity by route', () => {
    const entity = getCadastroEntity('equipes');
    expect(entity?.key).toBe('equipes');
  });

  it('builds expected grid test ids', () => {
    expect(cadastroGridTestId('indicadores-painel')).toBe('cadastro-card-indicadores-painel');
    expect(cadastroGridTestId('/admin')).toBe('cadastro-card-indicadores-metas');
  });
});

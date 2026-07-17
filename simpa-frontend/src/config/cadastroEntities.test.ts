import { describe, expect, it } from 'vitest';
import {
  CADASTRO_GRID_ITEMS,
  cadastroGridTestId,
  getCadastroEntity,
  getCadastroGridItem,
  type CadastroEntityMode,
} from './cadastroEntities';

const EXPECTED_GRID_MODES: Record<string, CadastroEntityMode> = {
  estabelecimentos: 'custom',
  procedimentos: 'readonly',
  formas: 'readonly',
  cbos: 'readonly',
  equipes: 'crud',
  emendas: 'crud',
  'metas-oci-par': 'custom',
  'indicadores-painel': 'custom',
  'procedimentos-sigtap': 'crud',
  '/admin': 'custom',
};

describe('cadastroEntities config', () => {
  it('includes indicadores-painel grid entry', () => {
    const item = CADASTRO_GRID_ITEMS.find((entry) => entry.route === 'indicadores-painel');
    expect(item?.title).toBe('Indicadores do Painel');
  });

  it('includes formas and cbos grid entries with MySQL read-only descriptions', () => {
    const formas = CADASTRO_GRID_ITEMS.find((entry) => entry.route === 'formas');
    const cbos = CADASTRO_GRID_ITEMS.find((entry) => entry.route === 'cbos');

    expect(formas?.title).toBe('Formas de Organização');
    expect(formas?.tableName).toBe('formas_sia');
    expect(formas?.description).toMatch(/MySQL/i);
    expect(formas?.description).toMatch(/Somente leitura/i);

    expect(cbos?.title).toBe('CBOs');
    expect(cbos?.tableName).toBe('cbos_sia');
    expect(cbos?.description).toMatch(/MySQL/i);
    expect(cbos?.description).toMatch(/Somente leitura/i);
  });

  it('assigns mode to every grid item', () => {
    expect(CADASTRO_GRID_ITEMS).toHaveLength(Object.keys(EXPECTED_GRID_MODES).length);
    for (const item of CADASTRO_GRID_ITEMS) {
      expect(item.mode).toBe(EXPECTED_GRID_MODES[item.route]);
    }
  });

  it('resolves entity by route', () => {
    const entity = getCadastroEntity('equipes');
    expect(entity?.key).toBe('equipes');
    expect(entity?.mode).toBe('crud');
  });

  it('resolves grid item by route', () => {
    expect(getCadastroGridItem('formas')?.mode).toBe('readonly');
    expect(getCadastroGridItem('estabelecimentos')?.mode).toBe('custom');
  });

  it('builds expected grid test ids', () => {
    expect(cadastroGridTestId('formas')).toBe('cadastro-card-formas');
    expect(cadastroGridTestId('cbos')).toBe('cadastro-card-cbos');
    expect(cadastroGridTestId('indicadores-painel')).toBe('cadastro-card-indicadores-painel');
    expect(cadastroGridTestId('/admin')).toBe('cadastro-card-indicadores-metas');
  });
});

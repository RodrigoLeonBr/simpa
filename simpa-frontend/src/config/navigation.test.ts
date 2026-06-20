import { describe, expect, it } from 'vitest';
import { resolveRouteMeta } from './navigation';

describe('navigation config', () => {
  it('resolves cadastros sub-routes to cadastros metadata', () => {
    expect(resolveRouteMeta('/cadastros/unidades')).toEqual({
      title: 'Cadastros',
      crumb: 'CRUD',
      showFilters: false,
    });
  });

  it('falls back to painel metadata for unknown routes', () => {
    expect(resolveRouteMeta('/unknown')).toEqual({
      title: 'Painel',
      crumb: 'Dashboard',
      showFilters: true,
    });
  });
});

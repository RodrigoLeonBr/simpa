import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, resolveRouteMeta } from './navigation';

describe('NAV_ITEMS', () => {
  it('includes /painel/populacao entry with label "População Cadastrada"', () => {
    const item = NAV_ITEMS.find((n) => n.to === '/painel/populacao');
    expect(item).toBeDefined();
    expect(item?.label).toBe('População Cadastrada');
  });

  it('/painel/populacao uses a valid icon key', () => {
    const item = NAV_ITEMS.find((n) => n.to === '/painel/populacao');
    expect(item?.icon).toBeTruthy();
  });
});

describe('navigation config', () => {
  it('resolves cadastros sub-routes to cadastros metadata', () => {
    expect(resolveRouteMeta('/cadastros/estabelecimentos')).toEqual({
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

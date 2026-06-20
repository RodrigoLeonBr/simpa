import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FiltersProvider, useFilters } from './useFilters';

describe('useFilters', () => {
  it('resets equipe when unidade changes', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FiltersProvider,
    });

    act(() => {
      result.current.setUnidadeId(1);
      result.current.setEquipeId(2);
    });

    expect(result.current.unidadeId).toBe(1);
    expect(result.current.equipeId).toBe(2);

    act(() => {
      result.current.setUnidadeId(3);
    });

    expect(result.current.unidadeId).toBe(3);
    expect(result.current.equipeId).toBeNull();
  });

  it('useFilters throws outside FiltersProvider', () => {
    expect(() => renderHook(() => useFilters())).toThrow(
      'useFilters must be used within FiltersProvider',
    );
  });
});

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FiltersProvider, useFilters } from './useFilters';

describe('useFilters', () => {
  it('initial painelPerfil is APS', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FiltersProvider,
    });

    expect(result.current.painelPerfil).toBe('APS');
  });

  it('setPainelPerfil updates context value', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FiltersProvider,
    });

    act(() => {
      result.current.setPainelPerfil('MAC');
    });

    expect(result.current.painelPerfil).toBe('MAC');
  });

  it('changing painelPerfil clears unidadeId and equipeId when previously set', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FiltersProvider,
    });

    act(() => {
      result.current.setUnidadeId(10);
      result.current.setEquipeId(20);
    });

    expect(result.current.unidadeId).toBe(10);
    expect(result.current.equipeId).toBe(20);

    act(() => {
      result.current.setPainelPerfil('Hospitalar');
    });

    expect(result.current.painelPerfil).toBe('Hospitalar');
    expect(result.current.unidadeId).toBeNull();
    expect(result.current.equipeId).toBeNull();
  });

  it('setCompetencia does not reset painelPerfil', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: FiltersProvider,
    });

    act(() => {
      result.current.setPainelPerfil('Misto');
      result.current.setCompetencia('2026-04');
    });

    expect(result.current.painelPerfil).toBe('Misto');
    expect(result.current.competencia).toBe('2026-04');
  });

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

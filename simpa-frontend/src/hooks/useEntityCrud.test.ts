import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEntityCrud } from './useEntityCrud';

interface TestEntity {
  id: number;
  nome: string;
}

function buildOptions(overrides: Partial<Parameters<typeof useEntityCrud<TestEntity>>[0]> = {}) {
  return {
    fetchList: vi.fn().mockResolvedValue([{ id: 1, nome: 'Alpha' }]),
    mapRowForTable: (row: TestEntity) => ({ id: row.id, nome: row.nome }),
    createItem: vi.fn().mockResolvedValue({ id: 2, nome: 'Beta' }),
    updateItem: vi.fn().mockResolvedValue({ id: 1, nome: 'Alpha updated' }),
    inactivateItem: vi.fn().mockResolvedValue({ inativado: true }),
    mapCreatePayload: (values: Record<string, string>) => ({ nome: values.nome }),
    mapUpdatePayload: (_values: Record<string, string>, row: TestEntity) => ({
      nome: `${row.nome} updated`,
    }),
    messages: {
      created: 'Criado',
      updated: 'Atualizado',
      inactivated: 'Inativado',
      deleted: 'Excluído',
    },
    ...overrides,
  };
}

describe('useEntityCrud', () => {
  it('carrega lista no mount', async () => {
    const fetchList = vi.fn().mockResolvedValue([{ id: 1, nome: 'Alpha' }]);
    const options = buildOptions({ fetchList });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchList).toHaveBeenCalledOnce();
    expect(result.current.rows).toEqual([{ id: 1, nome: 'Alpha' }]);
    expect(result.current.tableRows).toEqual([{ id: 1, nome: 'Alpha' }]);
  });

  it('openCreate e openEdit controlam formOpen/editingRow', async () => {
    const options = buildOptions();
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openCreate();
    });
    expect(result.current.formOpen).toBe(true);
    expect(result.current.editingRow).toBeNull();

    act(() => {
      result.current.openEdit({ id: 1, nome: 'Alpha' });
    });
    expect(result.current.editingRow).toEqual({ id: 1, nome: 'Alpha' });

    act(() => {
      result.current.closeForm();
    });
    expect(result.current.formOpen).toBe(false);
    expect(result.current.editingRow).toBeNull();
  });

  it('handleSubmit cria registro e recarrega', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, nome: 'Alpha' }])
      .mockResolvedValueOnce([
        { id: 1, nome: 'Alpha' },
        { id: 2, nome: 'Beta' },
      ]);
    const createItem = vi.fn().mockResolvedValue({ id: 2, nome: 'Beta' });

    const options = buildOptions({ fetchList, createItem });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSubmit({ nome: 'Beta' });
    });

    expect(createItem).toHaveBeenCalledWith({ nome: 'Beta' });
    expect(fetchList).toHaveBeenCalledTimes(2);
    expect(result.current.toast.message).toBe('Criado');
  });

  it('handleSubmit atualiza registro em edição', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, nome: 'Alpha' }])
      .mockResolvedValueOnce([{ id: 1, nome: 'Alpha updated' }]);
    const updateItem = vi.fn().mockResolvedValue({ id: 1, nome: 'Alpha updated' });

    const options = buildOptions({ fetchList, updateItem });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openEdit({ id: 1, nome: 'Alpha' });
    });

    await act(async () => {
      await result.current.handleSubmit({ nome: 'Alpha' });
    });

    expect(updateItem).toHaveBeenCalledWith(1, { nome: 'Alpha updated' });
    expect(result.current.toast.message).toBe('Atualizado');
  });

  it('handleSubmit delega para onSubmit customizado', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const createItem = vi.fn();

    const options = buildOptions({
      onSubmit,
      createItem,
      messages: { created: 'Custom criado', updated: 'Custom atualizado' },
    });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSubmit({ nome: 'X' });
    });

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'X' }, null);
    expect(createItem).not.toHaveBeenCalled();
    expect(result.current.toast.message).toBe('Custom criado');
  });

  it('openConfirm e handleConfirm inativam registro', async () => {
    const fetchList = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1, nome: 'Alpha' }])
      .mockResolvedValueOnce([]);
    const inactivateItem = vi.fn().mockResolvedValue({ inativado: true });

    const options = buildOptions({ fetchList, inactivateItem });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openConfirm({ id: 1, nome: 'Alpha' }, 'inactivate');
    });

    expect(result.current.confirmOpen).toBe(true);
    expect(result.current.confirmAction).toBe('inactivate');
    expect(result.current.confirmCopy.confirmLabel).toBe('Inativar');

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(inactivateItem).toHaveBeenCalledWith(1);
    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.toast.message).toBe('Inativado');
    expect(result.current.busyId).toBeNull();
  });

  it('handleConfirm usa deleteItem quando action é delete', async () => {
    const deleteItem = vi.fn().mockResolvedValue({ deleted: true });
    const inactivateItem = vi.fn();

    const options = buildOptions({ deleteItem, inactivateItem });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openConfirm({ id: 1, nome: 'Alpha' }, 'delete');
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(deleteItem).toHaveBeenCalledWith(1);
    expect(inactivateItem).not.toHaveBeenCalled();
    expect(result.current.toast.message).toBe('Excluído');
  });

  it('handleConfirm exibe toast em caso de erro', async () => {
    const inactivateItem = vi.fn().mockRejectedValue(new Error('Falha API'));

    const options = buildOptions({ inactivateItem });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openConfirm({ id: 1, nome: 'Alpha' });
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(result.current.toast.message).toBe('Falha API');
    expect(result.current.confirmOpen).toBe(true);
  });

  it('define error quando fetchList falha', async () => {
    const fetchList = vi.fn().mockRejectedValue(new Error('rede indisponível'));

    const options = buildOptions({ fetchList, errorMessage: 'Falha ao carregar usuários' });
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('rede indisponível');
    expect(result.current.rows).toEqual([]);
  });

  it('respeita autoLoad=false sem fetch inicial', async () => {
    const fetchList = vi.fn().mockResolvedValue([]);

    const options = buildOptions({ fetchList, autoLoad: false });
    const { result } = renderHook(() => useEntityCrud(options));

    expect(result.current.loading).toBe(false);
    expect(fetchList).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.carregar();
    });

    expect(fetchList).toHaveBeenCalledOnce();
  });

  it('closeConfirm limpa targetRow', async () => {
    const options = buildOptions();
    const { result } = renderHook(() => useEntityCrud(options));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openConfirm({ id: 1, nome: 'Alpha' });
    });

    act(() => {
      result.current.closeConfirm();
    });

    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.targetRow).toBeNull();
  });
});

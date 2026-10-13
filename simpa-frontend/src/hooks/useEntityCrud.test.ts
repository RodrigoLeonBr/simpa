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

  it('onSubmit em edição dispara toast de updated', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const options = buildOptions({ onSubmit, messages: { updated: 'Custom upd' } });
    const { result } = renderHook(() => useEntityCrud(options));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.openEdit({ id: 1, nome: 'Alpha' }));
    await act(async () => {
      await result.current.handleSubmit({ nome: 'X' });
    });
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'X' }, { id: 1, nome: 'Alpha' });
    expect(result.current.toast.message).toBe('Custom upd');
  });

  it('handleSubmit lança quando update/create não configurados', async () => {
    const editOpts = buildOptions({ updateItem: undefined, mapUpdatePayload: undefined });
    const edit = renderHook(() => useEntityCrud(editOpts));
    await waitFor(() => expect(edit.result.current.loading).toBe(false));
    act(() => edit.result.current.openEdit({ id: 1, nome: 'Alpha' }));
    await expect(edit.result.current.handleSubmit({ nome: 'X' })).rejects.toThrow('Atualização não configurada');

    const createOpts = buildOptions({ createItem: undefined, mapCreatePayload: undefined });
    const create = renderHook(() => useEntityCrud(createOpts));
    await waitFor(() => expect(create.result.current.loading).toBe(false));
    await expect(create.result.current.handleSubmit({ nome: 'X' })).rejects.toThrow('Criação não configurada');
  });

  it('toasts default quando messages ausentes (create/update/inactivate)', async () => {
    const options = buildOptions({ messages: {} });
    const { result } = renderHook(() => useEntityCrud(options));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.handleSubmit({ nome: 'Novo' }); });
    expect(result.current.toast.message).toBe('Registro criado');

    act(() => result.current.openEdit({ id: 1, nome: 'Alpha' }));
    await act(async () => { await result.current.handleSubmit({ nome: 'A' }); });
    expect(result.current.toast.message).toBe('Registro atualizado');
  });

  it('handleConfirm: retorno antecipado sem targetRow', async () => {
    const options = buildOptions();
    const { result } = renderHook(() => useEntityCrud(options));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleConfirm(); });
    expect(result.current.busyId).toBeNull();
  });

  it('handleConfirm delete cai para inactivateItem quando não há deleteItem', async () => {
    const inactivateItem = vi.fn().mockResolvedValue({});
    const options = buildOptions({ deleteItem: undefined, inactivateItem, messages: {} });
    const { result } = renderHook(() => useEntityCrud(options));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.openConfirm({ id: 1, nome: 'Alpha' }, 'delete'));
    await act(async () => { await result.current.handleConfirm(); });
    expect(inactivateItem).toHaveBeenCalledWith(1);
    expect(result.current.toast.message).toBe('Registro excluído');
  });

  it('handleConfirm lança quando exclusão/inativação não configuradas', async () => {
    const delOpts = buildOptions({ deleteItem: undefined, inactivateItem: undefined });
    const del = renderHook(() => useEntityCrud(delOpts));
    await waitFor(() => expect(del.result.current.loading).toBe(false));
    act(() => del.result.current.openConfirm({ id: 1, nome: 'A' }, 'delete'));
    await act(async () => { await del.result.current.handleConfirm(); });
    expect(del.result.current.toast.message).toBe('Exclusão não configurada');

    const inOpts = buildOptions({ inactivateItem: undefined });
    const inact = renderHook(() => useEntityCrud(inOpts));
    await waitFor(() => expect(inact.result.current.loading).toBe(false));
    act(() => inact.result.current.openConfirm({ id: 1, nome: 'A' }, 'inactivate'));
    await act(async () => { await inact.result.current.handleConfirm(); });
    expect(inact.result.current.toast.message).toBe('Inativação não configurada');
  });

  it('carregar usa mensagem de fallback quando erro não é Error', async () => {
    const fetchList = vi.fn().mockRejectedValue('string-err');
    const options = buildOptions({ fetchList, messages: { loadFailed: 'Falhou carga' } });
    const { result } = renderHook(() => useEntityCrud(options));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Falhou carga');
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

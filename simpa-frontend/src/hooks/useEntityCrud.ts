import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/shared/Toast';

export type ConfirmAction = 'inactivate' | 'delete';

export interface EntityCrudMessages {
  created?: string;
  updated?: string;
  inactivated?: string;
  deleted?: string;
  loadFailed?: string;
  operationFailed?: string;
}

export interface UseEntityCrudOptions<T extends { id: number }, TCreate = unknown, TUpdate = unknown> {
  fetchList: () => Promise<T[]>;
  mapRowForTable: (row: T) => Record<string, unknown>;
  errorMessage?: string;
  messages?: EntityCrudMessages;
  createItem?: (payload: TCreate) => Promise<unknown>;
  updateItem?: (id: number, payload: TUpdate) => Promise<unknown>;
  inactivateItem?: (id: number) => Promise<unknown>;
  deleteItem?: (id: number) => Promise<unknown>;
  mapCreatePayload?: (values: Record<string, string>) => TCreate;
  mapUpdatePayload?: (values: Record<string, string>, row: T) => TUpdate;
  /** Bypasses map* + create/update when pages need custom submit logic. */
  onSubmit?: (values: Record<string, string>, editing: T | null) => Promise<void>;
  autoLoad?: boolean;
}

export interface ConfirmCopy {
  title: string;
  message: string;
  confirmLabel: string;
}

export interface UseEntityCrudReturn<T extends { id: number }> {
  rows: T[];
  tableRows: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  carregar: () => Promise<void>;
  formOpen: boolean;
  editingRow: T | null;
  openCreate: () => void;
  openEdit: (row: T) => void;
  closeForm: () => void;
  confirmOpen: boolean;
  confirmAction: ConfirmAction;
  targetRow: T | null;
  openConfirm: (row: T, action?: ConfirmAction) => void;
  closeConfirm: () => void;
  handleConfirm: () => Promise<void>;
  busyId: number | null;
  handleSubmit: (values: Record<string, string>) => Promise<void>;
  confirmCopy: ConfirmCopy;
  toast: { message: string; visible: boolean };
  showToast: (message: string) => void;
}

const DEFAULT_CONFIRM_COPY: Record<ConfirmAction, ConfirmCopy> = {
  delete: {
    title: 'Excluir registro',
    message: 'Esta ação remove o registro da listagem ativa. Deseja continuar?',
    confirmLabel: 'Excluir',
  },
  inactivate: {
    title: 'Inativar registro',
    message: 'O registro ficará inativo e sairá da listagem. Deseja continuar?',
    confirmLabel: 'Inativar',
  },
};

export function useEntityCrud<T extends { id: number }, TCreate = unknown, TUpdate = unknown>(
  options: UseEntityCrudOptions<T, TCreate, TUpdate>,
): UseEntityCrudReturn<T> {
  const {
    fetchList,
    mapRowForTable,
    errorMessage = 'Falha ao carregar registros',
    messages = {},
    createItem,
    updateItem,
    inactivateItem,
    deleteItem,
    mapCreatePayload,
    mapUpdatePayload,
    onSubmit,
    autoLoad = true,
  } = options;

  const { toast, showToast } = useToast();

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>('inactivate');
  const [targetRow, setTargetRow] = useState<T | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchList();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.loadFailed ?? errorMessage);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchList, errorMessage, messages.loadFailed]);

  useEffect(() => {
    if (!autoLoad) return;
    void carregar();
  }, [autoLoad, carregar]);

  const tableRows = useMemo(() => rows.map(mapRowForTable), [rows, mapRowForTable]);

  const openCreate = useCallback(() => {
    setEditingRow(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: T) => {
    setEditingRow(row);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingRow(null);
  }, []);

  const openConfirm = useCallback((row: T, action: ConfirmAction = 'inactivate') => {
    setTargetRow(row);
    setConfirmAction(action);
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setTargetRow(null);
  }, []);

  const handleSubmit = useCallback(
    async (values: Record<string, string>) => {
      if (onSubmit) {
        await onSubmit(values, editingRow);
        if (editingRow) {
          if (messages.updated) showToast(messages.updated);
        } else if (messages.created) {
          showToast(messages.created);
        }
        await carregar();
        return;
      }

      if (editingRow) {
        if (!updateItem || !mapUpdatePayload) {
          throw new Error('Atualização não configurada');
        }
        await updateItem(editingRow.id, mapUpdatePayload(values, editingRow));
        showToast(messages.updated ?? 'Registro atualizado');
      } else {
        if (!createItem || !mapCreatePayload) {
          throw new Error('Criação não configurada');
        }
        await createItem(mapCreatePayload(values));
        showToast(messages.created ?? 'Registro criado');
      }

      await carregar();
    },
    [
      onSubmit,
      editingRow,
      updateItem,
      mapUpdatePayload,
      createItem,
      mapCreatePayload,
      messages.updated,
      messages.created,
      showToast,
      carregar,
    ],
  );

  const handleConfirm = useCallback(async () => {
    if (!targetRow) return;

    const id = targetRow.id;
    setBusyId(id);

    try {
      if (confirmAction === 'delete') {
        const remove = deleteItem ?? inactivateItem;
        if (!remove) {
          throw new Error('Exclusão não configurada');
        }
        await remove(id);
        showToast(messages.deleted ?? messages.inactivated ?? 'Registro excluído');
      } else {
        if (!inactivateItem) {
          throw new Error('Inativação não configurada');
        }
        await inactivateItem(id);
        showToast(messages.inactivated ?? 'Registro inativado');
      }

      closeConfirm();
      await carregar();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : messages.operationFailed ?? 'Falha na operação',
      );
    } finally {
      setBusyId(null);
    }
  }, [
    targetRow,
    confirmAction,
    deleteItem,
    inactivateItem,
    messages.deleted,
    messages.inactivated,
    messages.operationFailed,
    showToast,
    closeConfirm,
    carregar,
  ]);

  const confirmCopy = DEFAULT_CONFIRM_COPY[confirmAction];

  return {
    rows,
    tableRows,
    loading,
    error,
    carregar,
    formOpen,
    editingRow,
    openCreate,
    openEdit,
    closeForm,
    confirmOpen,
    confirmAction,
    targetRow,
    openConfirm,
    closeConfirm,
    handleConfirm,
    busyId,
    handleSubmit,
    confirmCopy,
    toast,
    showToast,
  };
}

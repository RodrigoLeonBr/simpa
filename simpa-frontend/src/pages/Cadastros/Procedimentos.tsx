import { useCallback, useEffect, useState } from 'react';
import { FilterBar } from '../../components/layout/FilterBar';
import type { EsusProcedimentoMap } from '../../types/contrato';
import {
  HELP_PURPOSE,
  HELP_REQUIRED,
  HELP_SILENT_SKIP,
  buildCreateMapBody,
  emptyMapForm,
  validateMapForm,
  type MapFormState,
} from './procedimentoMapForm';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function ProcedimentosPage() {
  const [rows, setRows] = useState<EsusProcedimentoMap[]>([]);
  const [secao, setSecao] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<MapFormState>(emptyMapForm());
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(true);

  const carregar = useCallback(() => {
    const params = new URLSearchParams();
    if (secao) params.set('secao', secao);
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const qs = params.toString();
    return fetch(`${BASE}/api/cadastros/esus-procedimento-map${qs ? `?${qs}` : ''}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []));
  }, [secao, q, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resetForm = () => {
    setForm(emptyMapForm());
    setEditId(null);
    setError(null);
  };

  const salvar = async () => {
    const validation = validateMapForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    const body = buildCreateMapBody(form);

    if (editId) {
      await fetch(`${BASE}/api/cadastros/esus-procedimento-map/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`${BASE}/api/cadastros/esus-procedimento-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    resetForm();
    carregar();
  };

  const editar = (row: EsusProcedimentoMap) => {
    setEditId(row.id);
    setForm({
      secao: row.secao,
      descricao_esus: row.descricao_esus,
      codigo_sigtap: row.codigo_sigtap,
      descricao: row.descricao_sigtap,
      origem: row.origem || 'manual',
    });
    setError(null);
  };

  const inativar = async (id: number) => {
    await fetch(`${BASE}/api/cadastros/esus-procedimento-map/${id}`, { method: 'DELETE' });
    carregar();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="CADASTROS — PROCEDIMENTOS (e-SUS ↔ SIGTAP)" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Help */}
        <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            className="w-full px-4 py-2 flex items-center justify-between text-left"
          >
            <span className="text-xs text-slate-400 font-semibold uppercase">Ajuda — de-para</span>
            <span className="text-slate-500 text-[10px]">{helpOpen ? 'ocultar' : 'mostrar'}</span>
          </button>
          {helpOpen && (
            <div className="px-4 pb-3 text-[11px] text-slate-400 leading-relaxed space-y-1.5 border-t border-dark-600 pt-2">
              <p>{HELP_PURPOSE}</p>
              <p>{HELP_REQUIRED}</p>
              <p>{HELP_SILENT_SKIP}</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-dark-700 rounded-xl p-3 flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase text-slate-500">Seção</span>
            <input
              value={secao}
              onChange={(e) => setSecao(e.target.value)}
              placeholder="Filtro exato de seção"
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600 min-w-[200px]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase text-slate-500">Busca (q)</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Label, código ou descrição SIGTAP"
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600 min-w-[220px]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase text-slate-500">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300"
            >
              <option value="">Ativos (padrão)</option>
              <option value="ativo">ativo</option>
              <option value="inativo">inativo</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => carregar()}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 border border-dark-600 rounded hover:bg-dark-800"
          >
            Filtrar
          </button>
        </div>

        {/* Form */}
        <div className="bg-dark-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-400 font-semibold uppercase">
            {editId ? `Editar mapeamento #${editId}` : 'Novo mapeamento'}
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Seção e-SUS (exata)"
              value={form.secao}
              onChange={(e) => setForm((p) => ({ ...p, secao: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600"
            />
            <input
              placeholder="Descrição e-SUS (exata)"
              value={form.descricao_esus}
              onChange={(e) => setForm((p) => ({ ...p, descricao_esus: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600"
            />
            <input
              placeholder="Código SIGTAP (10 dígitos)"
              value={form.codigo_sigtap}
              onChange={(e) => setForm((p) => ({ ...p, codigo_sigtap: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 font-mono placeholder-slate-600"
            />
            <input
              placeholder="Descrição SIGTAP (se criar código novo)"
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600"
            />
          </div>
          <div className="flex gap-2 self-end">
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-xs text-slate-400 border border-dark-600 rounded"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-blue rounded hover:bg-blue-700"
            >
              {editId ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                {['Seção', 'Descrição e-SUS', 'Código SIGTAP', 'Descrição SIGTAP', 'Origem', 'Status', ''].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-dark-600/40">
                  <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={r.secao}>
                    {r.secao}
                  </td>
                  <td className="px-3 py-2 text-slate-300 max-w-[200px]" title={r.descricao_esus}>
                    {r.descricao_esus}
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono">{r.codigo_sigtap}</td>
                  <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate" title={r.descricao_sigtap}>
                    {r.descricao_sigtap}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.origem}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        r.status === 'ativo'
                          ? 'bg-green-950 text-green-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => editar(r)}
                      className="text-slate-500 hover:text-sky-400 text-[10px] mr-2"
                    >
                      Editar
                    </button>
                    {r.status === 'ativo' && (
                      <button
                        type="button"
                        onClick={() => inativar(r.id)}
                        className="text-slate-500 hover:text-red-400 text-[10px]"
                      >
                        Inativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-600">
                    Nenhum mapeamento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FilterBar } from '../../components/layout/FilterBar';
import type { Unidade } from '../../types/contrato';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [form,     setForm]     = useState({ codigo: '', nome: '', tipo: 'APS', cnes: '' });

  const carregar = () =>
    fetch(`${BASE}/api/cadastros/unidades`).then(r => r.json()).then(setUnidades);

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    await fetch(`${BASE}/api/cadastros/unidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ codigo: '', nome: '', tipo: 'APS', cnes: '' });
    carregar();
  };

  const inativar = async (id: number) => {
    await fetch(`${BASE}/api/cadastros/unidades/${id}`, { method: 'DELETE' });
    carregar();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="CADASTROS — UNIDADES" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Formulário */}
        <div className="bg-dark-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-400 font-semibold uppercase">Nova Unidade</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'codigo', placeholder: 'Código' },
              { key: 'nome',   placeholder: 'Nome da unidade' },
              { key: 'cnes',   placeholder: 'CNES' },
            ].map(f => (
              <input
                key={f.key}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300 placeholder-slate-600"
              />
            ))}
            <select
              value={form.tipo}
              onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
              className="bg-dark-800 border border-dark-600 rounded px-2.5 py-1.5 text-sm text-slate-300"
            >
              {['APS','MAC','Hospitalar','Misto'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={salvar}
            disabled={!form.codigo || !form.nome}
            className="self-end px-4 py-1.5 text-xs font-semibold text-white bg-brand-blue rounded hover:bg-blue-700 disabled:opacity-40"
          >
            Salvar
          </button>
        </div>

        {/* Tabela */}
        <div className="bg-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                {['Código','Nome','Tipo','CNES','Status',''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unidades.map(u => (
                <tr key={u.id} className="border-b border-dark-600/40">
                  <td className="px-3 py-2 text-slate-400 font-mono">{u.codigo}</td>
                  <td className="px-3 py-2 text-slate-300">{u.nome}</td>
                  <td className="px-3 py-2 text-slate-400">{u.tipo}</td>
                  <td className="px-3 py-2 text-slate-500">{u.cnes || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      u.status === 'ativo'
                        ? 'bg-green-950 text-green-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => inativar(u.id)}
                      className="text-slate-500 hover:text-red-400 text-[10px]"
                    >
                      Inativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

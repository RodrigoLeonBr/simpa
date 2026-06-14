import { useState } from 'react';
import { RotateCcw, ArrowUpFromLine, Trash2 } from 'lucide-react';
import type { CargaEsus } from '../../types/contrato';
import { reprocessarCarga, excluirCarga } from '../../api/importacao';

interface Props {
  cargas: CargaEsus[];
  onAtualizar: () => void;
}

function StatusBadge({ reg, rej }: { reg: number | null; rej: number | null }) {
  if (reg == null) return <span className="bg-blue-900/50 text-sky-400 text-[9px] px-2 py-0.5 rounded-full">processando…</span>;
  if ((rej ?? 0) > 0) return <span className="bg-amber-900/50 text-amber-400 text-[9px] px-2 py-0.5 rounded-full">⚠ parcial</span>;
  return <span className="bg-green-950 text-green-400 text-[9px] px-2 py-0.5 rounded-full">✓ OK</span>;
}

export function HistoricoCargas({ cargas, onAtualizar }: Props) {
  const [confirmExcluir, setConfirmExcluir] = useState<number | null>(null);

  const handleReprocessar = async (id: number) => {
    await reprocessarCarga(id);
    onAtualizar();
  };

  const handleExcluir = async (id: number) => {
    if (confirmExcluir !== id) { setConfirmExcluir(id); return; }
    await excluirCarga(id);
    setConfirmExcluir(null);
    onAtualizar();
  };

  return (
    <div className="bg-dark-700 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-dark-600 flex items-center gap-2">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Histórico de Cargas</span>
        <span className="bg-dark-900 border border-dark-600 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-full">{cargas.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-600 bg-dark-800/50">
              {['Tipo', 'Competência', 'Unidade / Equipe', 'Registros', 'Status', 'Importado em', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargas.map(c => (
              <tr key={c.id} className="border-b border-dark-600/40 hover:bg-dark-600/20">
                <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{c.tipo_relatorio}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {c.competencia?.slice(0, 7)}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  <div>{c.unidade?.slice(0, 25)}{(c.unidade?.length ?? 0) > 25 ? '…' : ''}</div>
                  <div className="text-slate-500 text-[9px]">{c.equipe_nome}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-green-400">{c.registros_identificados ?? '—'}</span>
                  {(c.registros_nao_identificados ?? 0) > 0 && (
                    <span className="text-red-400 ml-1">/ {c.registros_nao_identificados} rej.</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge reg={c.registros_identificados} rej={c.registros_nao_identificados} />
                </td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                  {new Date(c.importado_em).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleReprocessar(c.id)}
                      title="Reprocessar"
                      className="bg-blue-900/30 hover:bg-blue-900/60 text-sky-400 rounded p-1"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      title="Substituir arquivo"
                      className="bg-dark-600 hover:bg-dark-500 text-slate-400 rounded p-1"
                    >
                      <ArrowUpFromLine size={11} />
                    </button>
                    <button
                      onClick={() => handleExcluir(c.id)}
                      title={confirmExcluir === c.id ? 'Clique para confirmar' : 'Excluir'}
                      className={`rounded p-1 ${
                        confirmExcluir === c.id
                          ? 'bg-red-900/60 text-red-400 ring-1 ring-red-500'
                          : 'bg-dark-600 hover:bg-dark-500 text-slate-500'
                      }`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

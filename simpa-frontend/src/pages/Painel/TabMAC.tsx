import type { ModuloSIA } from '../../types/contrato';

interface Props { sia: ModuloSIA }

export function TabMAC({ sia }: Props) {
  const conectado = sia.status_conexao === 'MySQL_XAMPP_CONNECTED';
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
        conectado ? 'bg-green-950/40 border border-green-900 text-green-400'
                  : 'bg-amber-950/40 border border-amber-900 text-amber-400'
      }`}>
        <div className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-400' : 'bg-amber-400'}`} />
        {conectado ? 'MySQL/XAMPP conectado' : 'Aguardando conexão SIA'}
      </div>
      {sia.procedimentos_especializados.length > 0 && (
        <div className="bg-dark-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="px-3 py-2 text-left text-slate-500">SIGTAP</th>
                <th className="px-3 py-2 text-left text-slate-500">Procedimento</th>
                <th className="px-3 py-2 text-right text-slate-500">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {sia.procedimentos_especializados.map(p => (
                <tr key={p.codigo_sigtap} className="border-b border-dark-600/50">
                  <td className="px-3 py-2 text-slate-400 font-mono">{p.codigo_sigtap}</td>
                  <td className="px-3 py-2 text-slate-300">{p.descricao}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-100">{p.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

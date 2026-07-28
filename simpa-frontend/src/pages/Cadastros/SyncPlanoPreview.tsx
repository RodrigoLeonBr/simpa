// ponytail: markup mínimo/sem estilo fino — refinar Tailwind ao integrar
import { useState } from 'react';
import type {
  SyncPlano,
  SyncPlanoItem,
  SyncPlanoAplicarItem,
} from '../../types/cadastros';

type Entidade = 'estabelecimento' | 'procedimento';
type Decisao = 'manter' | 'aplicar';

interface Props {
  plano: SyncPlano;
  onAplicar: (itens: SyncPlanoAplicarItem[]) => void;
  onCancelar: () => void;
}

const ABAS: { entidade: Entidade; label: string; key: keyof SyncPlano }[] = [
  { entidade: 'estabelecimento', label: 'Estabelecimentos', key: 'estabelecimentos' },
  { entidade: 'procedimento', label: 'Procedimentos', key: 'procedimentos' },
];

function itemId(entidade: Entidade, chave: string) {
  return `${entidade}:${chave}`;
}

export function SyncPlanoPreview({ plano, onAplicar, onCancelar }: Props) {
  const [abaIdx, setAbaIdx] = useState(0);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const aba = ABAS[abaIdx];
  const itens = plano[aba.key] as SyncPlanoItem[];

  const setDecisao = (id: string, d: Decisao) =>
    setDecisoes((prev) => ({ ...prev, [id]: d }));

  const marcarTodos = (d: Decisao) =>
    setDecisoes((prev) => {
      const next = { ...prev };
      for (const it of itens) next[itemId(aba.entidade, it.chave)] = d;
      return next;
    });

  const confirmar = () => {
    const payload: SyncPlanoAplicarItem[] = [];
    for (const { entidade, key } of ABAS) {
      for (const it of plano[key] as SyncPlanoItem[]) {
        if (decisoes[itemId(entidade, it.chave)] === 'aplicar') {
          payload.push({ ...it, entidade });
        }
      }
    }
    onAplicar(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {ABAS.map((a, i) => (
          <button
            key={a.entidade}
            type="button"
            onClick={() => setAbaIdx(i)}
            className={i === abaIdx ? 'font-bold underline' : ''}
          >
            {a.label} ({(plano[a.key] as SyncPlanoItem[]).length})
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => marcarTodos('aplicar')}>Aplicar todos</button>
        <button type="button" onClick={() => marcarTodos('manter')}>Manter todos</button>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {itens.map((it) => {
            const id = itemId(aba.entidade, it.chave);
            const decisao = decisoes[id] ?? 'manter';
            return (
              <tr key={id} className="border-b">
                <td>{it.chave}</td>
                <td><span data-tipo={it.tipo}>{it.tipo}</span></td>
                <td>
                  {Object.entries(it.diff).map(([campo, v]) => (
                    <div key={campo}>
                      <strong>{campo}:</strong>{' '}
                      {'simpa' in v ? <span>SIMPA={String(v.simpa)}</span> : null}{' '}
                      {'mysql' in v ? <span>MySQL={String(v.mysql)}</span> : null}
                    </div>
                  ))}
                </td>
                <td>
                  <label>
                    <input type="radio" name={id} checked={decisao === 'manter'}
                      onChange={() => setDecisao(id, 'manter')} /> Manter
                  </label>
                  <label>
                    <input type="radio" name={id} checked={decisao === 'aplicar'}
                      onChange={() => setDecisao(id, 'aplicar')} /> Aplicar
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar}>Cancelar</button>
        <button type="button" onClick={confirmar}>Confirmar</button>
      </div>
    </div>
  );
}

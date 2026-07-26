import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcedimentosMapeadosTable, EMPTY_MAPPED_MSG } from './ProcedimentosMapeadosTable';
import type { ProcedimentoMapeado } from '../../types/contrato';
import { TabAPS } from './TabAPS';
import { FiltersProvider } from '../../hooks/useFilters';

const ROWS: ProcedimentoMapeado[] = [
  {
    secao: 'Procedimentos - Teste rápido',
    descricao_esus: 'Para HIV',
    codigo_sigtap: '0214010058',
    descricao_sigtap: 'TESTE RAPIDO HIV',
    quantidade: 12,
  },
];

describe('ProcedimentosMapeadosTable', () => {
  it('renders one row per mapped item with codigo_sigtap visible', () => {
    render(<ProcedimentosMapeadosTable rows={ROWS} />);
    expect(screen.getByText('0214010058')).toBeInTheDocument();
    expect(screen.getByText('Para HIV')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('empty array shows empty-state, not a crash', () => {
    render(<ProcedimentosMapeadosTable rows={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(EMPTY_MAPPED_MSG);
  });
});

describe('TabAPS with mapped procedures', () => {
  it('Painel with mock payload containing procedimentos_mapeados shows the section', () => {
    render(
      <FiltersProvider>
        <TabAPS
          kpis={{
            total_atendimentos_aps: 1,
            total_procedimentos_ambulatoriais: 0,
            total_participantes_coletivos: 0,
            atendimentos_odonto: 0,
          }}
          aps={{
            distribuicao_turnos: [],
            temas_coletivos: [],
            distribuicao_faixa_etaria: [],
            historico_mensal: [],
            procedimentos_mapeados: ROWS,
          }}
        />
      </FiltersProvider>
    );
    expect(
      screen.getByText(/Procedimentos mapeados \(e-SUS → SIGTAP\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText('0214010058')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ContratoDashboard } from '../../types/contrato';
import mockDb from '../../../mock/db.json';
import { QualityBars } from './QualityBars';

describe('QualityBars', () => {
  it('renders progress bars with exec and meta markers', () => {
    const data = {
      ...(mockDb.planejamento[0] as ContratoDashboard),
      indicadores_qualidade: [
        {
          ...(mockDb.planejamento[0] as ContratoDashboard).indicadores_qualidade[0]!,
          exec: 0.75,
          meta: 0.8,
        },
      ],
    };

    const { container } = render(<QualityBars data={data} />);
    expect(screen.getByText(/C1/)).toBeInTheDocument();
    expect(container.querySelector('.quality-meta-marker')).toBeInTheDocument();
  });
});

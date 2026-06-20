import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveMetaStatus } from '../../utils/indicadoresView';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders status label with tone class', () => {
    render(<StatusBadge status={resolveMetaStatus(0.62, 0.5)} />);
    expect(screen.getByText('atingida')).toHaveClass('status-badge-green');
  });
});

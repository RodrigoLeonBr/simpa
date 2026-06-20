import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders exec fill and meta marker', () => {
    const { container } = render(
      <ProgressBar execWidthPct={58} metaWidthPct={60} color="#1f8a5b" execLabel="executado 58,0%" metaLabel="meta 60,0%" />,
    );

    expect(container.querySelector('.progress-bar-fill')).toHaveStyle({ width: '58%' });
    expect(container.querySelector('.progress-bar-meta')).toBeInTheDocument();
    expect(screen.getByText('executado 58,0%')).toBeInTheDocument();
  });
});

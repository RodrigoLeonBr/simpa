import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('shows monogram fallback when image fails to load', () => {
    render(<Logo size={32} />);

    const img = screen.getByRole('img', { name: 'SIMPA' });
    fireEvent.error(img);

    expect(screen.getByText('S')).toBeInTheDocument();
  });
});

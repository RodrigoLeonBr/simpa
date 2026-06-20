import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileSwitcher } from './ProfileSwitcher';

describe('ProfileSwitcher', () => {
  afterEach(() => cleanup());

  it('calls onChange when profile button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ProfileSwitcher perfil="APS" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Hospitalar' }));

    expect(onChange).toHaveBeenCalledWith('Hospitalar');
  });

  it('marks active profile with aria-pressed', () => {
    render(<ProfileSwitcher perfil="MAC" onChange={vi.fn()} />);

    expect(screen.getByTestId('profile-switch-mac')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('profile-switch-aps')).toHaveAttribute('aria-pressed', 'false');
  });
});

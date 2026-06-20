import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  getStoredTheme,
  initTheme,
  setTheme,
  toggleTheme,
  THEME_STORAGE_KEY,
} from './theme';

describe('theme utils', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light theme', () => {
    expect(getStoredTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('setTheme stores and applies dark theme on documentElement', () => {
    setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme switches data-theme on documentElement', () => {
    expect(toggleTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    expect(toggleTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('applyTheme removes attribute for light mode', () => {
    applyTheme('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('initTheme applies stored preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(initTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'simpa-theme';

export function getStoredTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme(): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

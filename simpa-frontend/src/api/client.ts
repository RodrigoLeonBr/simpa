export function apiBase(): string {
  return import.meta.env.VITE_API_BASE || 'http://localhost:3100';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

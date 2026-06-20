export function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return import.meta.env.DEV ? 'http://localhost:3001' : '';
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let tokenProvider: (() => string | null) | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function setTokenProvider(provider: (() => string | null) | null): void {
  tokenProvider = provider;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = init?.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = tokenProvider?.();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

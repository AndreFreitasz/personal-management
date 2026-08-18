import { getAccessToken, runRefresh } from './token-store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function messageOf(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message
        .map((item) => String(item).trim())
        .filter(Boolean)
        .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
        .join(' ');
    }
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const raw = await response.text();
  const body: unknown = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new ApiError(response.status, messageOf(body, response.statusText), body);
  }

  return body as T;
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();

  try {
    return await rawRequest<T>(path, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (retry && error instanceof ApiError && error.status === 401 && (await runRefresh())) {
      return api<T>(path, init, false);
    }
    throw error;
  }
}

export const get = <T>(path: string): Promise<T> => api<T>(path);

export const post = <T>(path: string, body?: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const patch = <T>(path: string, body: unknown): Promise<T> =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const del = <T = void>(path: string, body?: unknown): Promise<T> =>
  api<T>(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export function query(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

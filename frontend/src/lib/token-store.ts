const REFRESH_KEY = 'financas.refresh';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  defaultCurrency: string;
  timezone: string;
}

export interface SessionState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: SessionUser | null;
  accessToken: string | null;
}

let state: SessionState = { status: 'loading', user: null, accessToken: null };
const listeners = new Set<() => void>();

let refreshHandler: (() => Promise<boolean>) | null = null;

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

export function runRefresh(): Promise<boolean> {
  return refreshHandler ? refreshHandler() : Promise.resolve(false);
}

export function getState(): SessionState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function setSession(user: SessionUser, accessToken: string, refreshToken: string): void {
  localStorage.setItem(REFRESH_KEY, refreshToken);
  emit({ status: 'authenticated', user, accessToken });
}

export function clearSession(): void {
  localStorage.removeItem(REFRESH_KEY);
  emit({ status: 'anonymous', user: null, accessToken: null });
}

export function markAnonymous(): void {
  emit({ status: 'anonymous', user: null, accessToken: null });
}

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);
export const getAccessToken = (): string | null => state.accessToken;

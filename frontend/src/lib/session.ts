import { useSyncExternalStore } from 'react';

import { rawRequest } from './api';
import {
  clearSession,
  getRefreshToken,
  getState,
  markAnonymous,
  SessionState,
  SessionUser,
  setRefreshHandler,
  setSession,
  subscribe,
} from './token-store';

interface AuthResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<void> {
  const auth = await rawRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setSession(auth.user, auth.accessToken, auth.refreshToken);
}

export async function register(name: string, email: string, password: string): Promise<void> {
  const auth = await rawRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setSession(auth.user, auth.accessToken, auth.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearSession();

  if (refreshToken) {
    try {
      await rawRequest<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {}
  }
}

export function forgotPassword(email: string): Promise<void> {
  return rawRequest<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  inFlight ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      markAnonymous();
      return false;
    }

    try {
      const auth = await rawRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      setSession(auth.user, auth.accessToken, auth.refreshToken);
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

setRefreshHandler(refreshSession);

export function bootstrapSession(): void {
  if (getRefreshToken()) {
    void refreshSession();
  } else {
    markAnonymous();
  }
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export type { SessionUser };

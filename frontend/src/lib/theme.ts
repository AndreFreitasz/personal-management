import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'financas.tema';

const listeners = new Set<() => void>();
let preference: ThemePreference = readStored();

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'light';
  } catch {
    return 'light';
  }
}

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(): void {
  document.documentElement.dataset.theme = resolve(preference);
}

export function setTheme(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  apply();
  for (const listener of listeners) listener();
}

export function initTheme(): void {
  apply();
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => preference === 'system' && apply());
}

export function useTheme(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => preference,
    () => 'light' as ThemePreference,
  );
}

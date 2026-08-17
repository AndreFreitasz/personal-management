const SERIES_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVXZ';

function fnv1a(seed: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

export function serialFrom(seed: string): string {
  const hash = fnv1a(seed.trim().toLowerCase());
  const series = SERIES_ALPHABET[hash % SERIES_ALPHABET.length];
  const check = SERIES_ALPHABET[(hash >>> 11) % SERIES_ALPHABET.length];

  const left = String(hash % 10000).padStart(4, '0');
  const right = String((hash >>> 7) % 100000).padStart(5, '0');

  return `${series} ${left} ${right} ${check}`;
}

export function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1 || /\d/.test(word));

  if (words.length === 0) return '';

  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';

  return (first + last).toLocaleUpperCase('pt-BR');
}

export function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return initialsFromName(local.replace(/[._\-+]+/g, ' ').replace(/\d+/g, ' '));
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export interface Plates {
  engraved: boolean;
  numbered: boolean;
  backed: boolean;
  sealed: boolean;
}

export const BLANK_PLATES: Plates = {
  engraved: false,
  numbered: false,
  backed: false,
  sealed: false,
};

export const ALL_PLATES: Plates = {
  engraved: true,
  numbered: true,
  backed: true,
  sealed: true,
};

export function platesDone(plates: Plates): number {
  return Object.values(plates).filter(Boolean).length;
}

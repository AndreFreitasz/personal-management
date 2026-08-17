const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatMoney(value: number, currency = 'BRL'): string {
  if (currency === 'BRL') return BRL.format(value);

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return DATE.format(new Date(year, month - 1, day));
}

const DAY_LONG = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export function formatDayLong(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return DAY_LONG.format(new Date(year, month - 1, day));
}

const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export function formatCompetence(competence: string): string {
  const [year, month] = competence.split('-').map(Number);
  return MONTH.format(new Date(year, month - 1, 1));
}

export function formatSigned(value: number, kind: 'credit' | 'debit'): string {
  const sign = kind === 'credit' ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(value))}`;
}

const COMPACT = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCompact(value: number): string {
  if (value === 0) return '0';
  return COMPACT.format(value);
}

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function formatPercent(ratio: number): string {
  return PERCENT.format(ratio);
}

export function todayForInput(): string {
  return new Intl.DateTimeFormat('sv-SE').format(new Date());
}

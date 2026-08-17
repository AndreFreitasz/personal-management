export enum PeriodPreset {
  ThisMonth = 'this-month',
  LastMonth = 'last-month',
  Last3Months = 'last-3-months',
  Last6Months = 'last-6-months',
  Last12Months = 'last-12-months',
  ThisYear = 'this-year',
  Custom = 'custom',
}

export interface Period {
  from: Date;
  to: Date;
}

const MONTH_SPAN: Partial<Record<PeriodPreset, number>> = {
  [PeriodPreset.ThisMonth]: 1,
  [PeriodPreset.Last3Months]: 3,
  [PeriodPreset.Last6Months]: 6,
  [PeriodPreset.Last12Months]: 12,
};

function monthStart(at: Date, months = 0): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, 1));
}

function monthEnd(at: Date, months = 0): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months + 1, 1) - 1);
}

export function resolvePeriod(preset: PeriodPreset, now: Date, custom?: Partial<Period>): Period {
  if (preset === PeriodPreset.Custom) {
    return { from: custom?.from ?? monthStart(now), to: custom?.to ?? now };
  }

  if (preset === PeriodPreset.LastMonth) {
    return { from: monthStart(now, -1), to: monthEnd(now, -1) };
  }

  if (preset === PeriodPreset.ThisYear) {
    return {
      from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      to: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1) - 1),
    };
  }

  const span = MONTH_SPAN[preset] ?? 1;
  return { from: monthStart(now, -(span - 1)), to: monthEnd(now) };
}

export function previousPeriod(period: Period): Period {
  if (isWholeMonths(period)) {
    const months = monthsBetween(period.from, period.to);
    return { from: monthStart(period.from, -months), to: monthEnd(period.from, -1) };
  }

  const span = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - span - 1),
    to: new Date(period.from.getTime() - 1),
  };
}

export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1
  );
}

function isWholeMonths(period: Period): boolean {
  return (
    period.from.getTime() === monthStart(period.from).getTime() &&
    period.to.getTime() === monthEnd(period.to).getTime()
  );
}

export function competenceKey(at: Date): string {
  return `${at.getUTCFullYear()}-${`${at.getUTCMonth() + 1}`.padStart(2, '0')}-01`;
}

export function competencesIn(period: Period): string[] {
  const keys: string[] = [];
  const cursor = monthStart(period.from);
  while (cursor.getTime() <= period.to.getTime()) {
    keys.push(competenceKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

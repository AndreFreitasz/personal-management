const DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function toUtc(date: string): Date {
  const match = DATE.exec(date);
  if (!match) {
    throw new Error(`Data invalida: "${date}". Use AAAA-MM-DD.`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toIso(parsed) !== date) {
    throw new Error(`Data invalida: "${date}". Data inexistente no calendario.`);
  }

  return parsed;
}

function toIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isBusinessDay(date: string): boolean {
  const weekday = toUtc(date).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

export function lastDayOfMonth(competence: string): number {
  const start = toUtc(competence);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
}

export function nthBusinessDay(competence: string, n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Dia util invalido: ${n}. Use inteiro a partir de 1.`);
  }

  const start = toUtc(competence);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const total = lastDayOfMonth(competence);

  let seen = 0;
  for (let day = 1; day <= total; day++) {
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    seen += 1;
    if (seen === n) return toIso(new Date(Date.UTC(year, month, day)));
  }

  throw new Error(`Mes ${competence.slice(0, 7)} tem ${seen} dias uteis; o ${n}o nao existe.`);
}

export function lastBusinessDay(competence: string): string {
  const start = toUtc(competence);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();

  for (let day = lastDayOfMonth(competence); day >= 1; day--) {
    const candidate = new Date(Date.UTC(year, month, day));
    const weekday = candidate.getUTCDay();
    if (weekday !== 0 && weekday !== 6) return toIso(candidate);
  }

  throw new Error(`Mes ${competence.slice(0, 7)} sem nenhum dia util.`);
}

export function shiftToBusinessDay(date: string, direction: 'previous' | 'next'): string {
  const step = direction === 'previous' ? -1 : 1;
  const cursor = toUtc(date);

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }

  return toIso(cursor);
}

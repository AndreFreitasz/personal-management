const STORED = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const INPUT = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;

export function competenceOf(occurredAt: Date): string {
  const year = occurredAt.getUTCFullYear();
  const month = `${occurredAt.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
}

export function parseCompetence(input: string): string {
  const match = INPUT.exec(input);
  if (!match) {
    throw new Error(`Competencia invalida: "${input}". Use AAAA-MM.`);
  }

  const [, year, month, day] = match;

  if (day !== undefined) {
    const probe = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== Number(day)) {
      throw new Error(`Competencia invalida: "${input}". Data inexistente.`);
    }
  }

  return `${year}-${month}-01`;
}

export function isCompetence(value: string): boolean {
  return STORED.test(value);
}

export function shiftCompetence(competence: string, months: number): string {
  const [year, month] = competence.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return competenceOf(date);
}

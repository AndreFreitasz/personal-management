import {
  lastBusinessDay,
  lastDayOfMonth,
  nthBusinessDay,
  shiftToBusinessDay,
} from '../common/date/business-days';
import { shiftCompetence } from '../common/date/competence';

export enum ScheduleType {
  DayOfMonth = 'day_of_month',
  FifthBusinessDay = 'fifth_business_day',
  LastBusinessDay = 'last_business_day',
}

export enum Adjustment {
  None = 'none',
  PreviousBusinessDay = 'previous_business_day',
  NextBusinessDay = 'next_business_day',
}

export interface Schedule {
  type: ScheduleType;
  dayOfMonth: number | null;
  adjustment: Adjustment;
}

export interface RecurrenceWindow {
  startsOn: string;
  endsOn: string | null;
  installments: number | null;
  createdCompetence: string;
  paused: boolean;
}

export interface AmountPeriod {
  amount: number;
  validFrom: string;
}

export function occurrenceFor(competence: string, schedule: Schedule): string {
  const raw = rawOccurrence(competence, schedule);

  switch (schedule.adjustment) {
    case Adjustment.PreviousBusinessDay:
      return shiftToBusinessDay(raw, 'previous');
    case Adjustment.NextBusinessDay:
      return shiftToBusinessDay(raw, 'next');
    case Adjustment.None:
      return raw;
  }
}

function rawOccurrence(competence: string, schedule: Schedule): string {
  switch (schedule.type) {
    case ScheduleType.DayOfMonth: {
      if (schedule.dayOfMonth === null) {
        throw new Error('Agendamento por dia fixo exige `dayOfMonth`.');
      }
      if (
        !Number.isInteger(schedule.dayOfMonth) ||
        schedule.dayOfMonth < 1 ||
        schedule.dayOfMonth > 31
      ) {
        throw new Error(`Dia do mes invalido: ${schedule.dayOfMonth}. Use 1..31.`);
      }

      const day = Math.min(schedule.dayOfMonth, lastDayOfMonth(competence));
      return `${competence.slice(0, 8)}${`${day}`.padStart(2, '0')}`;
    }

    case ScheduleType.FifthBusinessDay:
      return nthBusinessDay(competence, 5);

    case ScheduleType.LastBusinessDay:
      return lastBusinessDay(competence);
  }
}

export function dueCompetences(
  window: RecurrenceWindow,
  upTo: string,
  options: { includeBeforeCreation?: boolean } = {},
): string[] {
  if (window.paused) return [];

  const floor = options.includeBeforeCreation
    ? window.startsOn
    : maxCompetence(window.startsOn, window.createdCompetence);

  const ceiling = minCompetence(upTo, effectiveEnd(window));
  if (ceiling === null || floor > ceiling) return [];

  const competences: string[] = [];
  for (let cursor = floor; cursor <= ceiling; cursor = shiftCompetence(cursor, 1)) {
    competences.push(cursor);
  }

  return competences;
}

function effectiveEnd(window: RecurrenceWindow): string | null {
  if (window.installments !== null) {
    return shiftCompetence(window.startsOn, window.installments - 1);
  }
  return window.endsOn;
}

export function installmentNumber(startsOn: string, competence: string): number {
  const [startYear, startMonth] = startsOn.split('-').map(Number);
  const [year, month] = competence.split('-').map(Number);
  return (year - startYear) * 12 + (month - startMonth) + 1;
}

export function amountFor(periods: AmountPeriod[], competence: string): number {
  const applicable = periods
    .filter((period) => period.validFrom <= competence)
    .sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1));

  const current = applicable.at(-1);
  if (current === undefined) {
    throw new Error(`Sem valor vigente para a competencia ${competence}.`);
  }

  return current.amount;
}

function maxCompetence(a: string, b: string): string {
  return a > b ? a : b;
}

function minCompetence(a: string, b: string | null): string | null {
  if (b === null) return a;
  return a < b ? a : b;
}

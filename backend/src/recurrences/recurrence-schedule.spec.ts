import {
  Adjustment,
  ScheduleType,
  amountFor,
  dueCompetences,
  installmentNumber,
  occurrenceFor,
} from './recurrence-schedule';

const schedule = (
  type: ScheduleType,
  dayOfMonth: number | null = null,
  adjustment: Adjustment = Adjustment.None,
) => ({ type, dayOfMonth, adjustment });

describe('recurrence-schedule', () => {
  describe('occurrenceFor — dia fixo', () => {
    it('respeita o dia quando ele existe no mes', () => {
      expect(occurrenceFor('2026-09-01', schedule(ScheduleType.DayOfMonth, 10))).toBe('2026-09-10');
    });

    it('clampa dia 31 para o ultimo dia do mes, sem pular o mes', () => {
      expect(occurrenceFor('2026-02-01', schedule(ScheduleType.DayOfMonth, 31))).toBe('2026-02-28');
      expect(occurrenceFor('2026-04-01', schedule(ScheduleType.DayOfMonth, 31))).toBe('2026-04-30');
    });

    it('clampa para 29 em fevereiro bissexto', () => {
      expect(occurrenceFor('2028-02-01', schedule(ScheduleType.DayOfMonth, 31))).toBe('2028-02-29');
    });

    it('exige dia do mes neste tipo', () => {
      expect(() => occurrenceFor('2026-09-01', schedule(ScheduleType.DayOfMonth, null))).toThrow();
    });
  });

  describe('occurrenceFor — dia util', () => {
    it('resolve o 5o dia util', () => {
      expect(occurrenceFor('2026-09-01', schedule(ScheduleType.FifthBusinessDay))).toBe(
        '2026-09-07',
      );
    });

    it('resolve o ultimo dia util', () => {
      expect(occurrenceFor('2026-05-01', schedule(ScheduleType.LastBusinessDay))).toBe(
        '2026-05-29',
      );
    });

    it('nao se abala com ajuste configurado, que aqui nao tem o que ajustar', () => {
      const comAjuste = schedule(ScheduleType.FifthBusinessDay, null, Adjustment.NextBusinessDay);
      expect(occurrenceFor('2026-09-01', comAjuste)).toBe('2026-09-07');
    });
  });

  describe('occurrenceFor — ajuste de fim de semana', () => {
    it('antecipa para a sexta anterior', () => {
      const s = schedule(ScheduleType.DayOfMonth, 5, Adjustment.PreviousBusinessDay);
      expect(occurrenceFor('2026-09-01', s)).toBe('2026-09-04');
    });

    it('posterga para a segunda seguinte', () => {
      const s = schedule(ScheduleType.DayOfMonth, 5, Adjustment.NextBusinessDay);
      expect(occurrenceFor('2026-09-01', s)).toBe('2026-09-07');
    });

    it('nao mexe na data quando o ajuste e none', () => {
      const s = schedule(ScheduleType.DayOfMonth, 5, Adjustment.None);
      expect(occurrenceFor('2026-09-01', s)).toBe('2026-09-05');
    });

    it('sai do mes da competencia quando o ajuste manda', () => {
      const antecipa = schedule(ScheduleType.DayOfMonth, 1, Adjustment.PreviousBusinessDay);
      expect(occurrenceFor('2026-11-01', antecipa)).toBe('2026-10-30');

      const posterga = schedule(ScheduleType.DayOfMonth, 31, Adjustment.NextBusinessDay);
      expect(occurrenceFor('2026-02-01', posterga)).toBe('2026-03-02');
    });
  });

  describe('dueCompetences — vigencia', () => {
    const base = {
      startsOn: '2026-01-01',
      endsOn: null,
      installments: null,
      createdCompetence: '2026-01-01',
      paused: false,
    };

    it('lista do inicio a competencia corrente, inclusive', () => {
      expect(dueCompetences(base, '2026-03-01')).toEqual([
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
      ]);
    });

    it('nao gera nada antes do inicio', () => {
      expect(dueCompetences({ ...base, startsOn: '2026-05-01' }, '2026-03-01')).toEqual([]);
    });

    it('para no fim da vigencia', () => {
      expect(dueCompetences({ ...base, endsOn: '2026-02-01' }, '2026-06-01')).toEqual([
        '2026-01-01',
        '2026-02-01',
      ]);
    });

    it('nao gera nada enquanto pausada', () => {
      expect(dueCompetences({ ...base, paused: true }, '2026-06-01')).toEqual([]);
    });

    it('NAO retroage antes do cadastro, por padrao', () => {
      const atrasada = { ...base, startsOn: '2026-05-01', createdCompetence: '2026-08-01' };
      expect(dueCompetences(atrasada, '2026-09-01')).toEqual(['2026-08-01', '2026-09-01']);
    });

    it('retroage a data de inicio quando pedido explicitamente', () => {
      const atrasada = { ...base, startsOn: '2026-05-01', createdCompetence: '2026-08-01' };
      expect(dueCompetences(atrasada, '2026-09-01', { includeBeforeCreation: true })).toEqual([
        '2026-05-01',
        '2026-06-01',
        '2026-07-01',
        '2026-08-01',
        '2026-09-01',
      ]);
    });

    it('recupera meses perdidos desde o cadastro', () => {
      expect(dueCompetences(base, '2026-04-01')).toHaveLength(4);
    });
  });

  describe('dueCompetences — parcelamento', () => {
    const parcelado = {
      startsOn: '2026-01-01',
      endsOn: null,
      installments: 12,
      createdCompetence: '2026-01-01',
      paused: false,
    };

    it('encerra sozinho na ultima parcela', () => {
      const todas = dueCompetences(parcelado, '2027-06-01');
      expect(todas).toHaveLength(12);
      expect(todas.at(-1)).toBe('2026-12-01');
    });
  });

  describe('installmentNumber', () => {
    it('numera a partir de 1', () => {
      expect(installmentNumber('2026-01-01', '2026-01-01')).toBe(1);
      expect(installmentNumber('2026-01-01', '2026-03-01')).toBe(3);
      expect(installmentNumber('2026-01-01', '2026-12-01')).toBe(12);
    });

    it('atravessa a virada do ano', () => {
      expect(installmentNumber('2026-11-01', '2027-02-01')).toBe(4);
    });
  });

  describe('amountFor — reajuste com historico', () => {
    const periodos = [
      { amount: 5000, validFrom: '2026-01-01' },
      { amount: 5500, validFrom: '2026-05-01' },
    ];

    it('usa o valor vigente na competencia', () => {
      expect(amountFor(periodos, '2026-04-01')).toBe(5000);
      expect(amountFor(periodos, '2026-05-01')).toBe(5500);
      expect(amountFor(periodos, '2026-09-01')).toBe(5500);
    });

    it('nao depende da ordem de entrada', () => {
      expect(amountFor([...periodos].reverse(), '2026-04-01')).toBe(5000);
    });

    it('recusa competencia anterior ao primeiro valor', () => {
      expect(() => amountFor(periodos, '2025-12-01')).toThrow();
    });

    it('recusa lista vazia', () => {
      expect(() => amountFor([], '2026-01-01')).toThrow();
    });
  });
});

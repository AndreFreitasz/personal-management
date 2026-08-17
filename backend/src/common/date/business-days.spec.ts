import {
  isBusinessDay,
  lastBusinessDay,
  lastDayOfMonth,
  nthBusinessDay,
  shiftToBusinessDay,
} from './business-days';

describe('business-days', () => {
  describe('isBusinessDay', () => {
    it('reconhece segunda a sexta', () => {
      expect(isBusinessDay('2026-09-07')).toBe(true);
      expect(isBusinessDay('2026-09-04')).toBe(true);
    });

    it('recusa sabado e domingo', () => {
      expect(isBusinessDay('2026-09-05')).toBe(false);
      expect(isBusinessDay('2026-11-01')).toBe(false);
    });

    it('considera feriado nacional um dia util, por decisao', () => {
      expect(isBusinessDay('2026-09-07')).toBe(true);
    });
  });

  describe('lastDayOfMonth', () => {
    it('resolve meses de 30 e 31 dias', () => {
      expect(lastDayOfMonth('2026-04-01')).toBe(30);
      expect(lastDayOfMonth('2026-08-01')).toBe(31);
    });

    it('resolve fevereiro comum e bissexto', () => {
      expect(lastDayOfMonth('2026-02-01')).toBe(28);
      expect(lastDayOfMonth('2028-02-01')).toBe(29);
    });
  });

  describe('nthBusinessDay', () => {
    it('acha o 5o dia util quando o mes comeca numa terca', () => {
      expect(nthBusinessDay('2026-09-01', 5)).toBe('2026-09-07');
    });

    it('acha o 5o dia util quando o mes comeca num fim de semana', () => {
      expect(nthBusinessDay('2026-08-01', 5)).toBe('2026-08-07');
    });

    it('conta a partir do primeiro dia util, nao do dia 1', () => {
      expect(nthBusinessDay('2026-08-01', 1)).toBe('2026-08-03');
      expect(nthBusinessDay('2026-02-01', 1)).toBe('2026-02-02');
    });

    it('recusa mes sem dias uteis suficientes', () => {
      expect(() => nthBusinessDay('2026-02-01', 21)).toThrow();
      expect(nthBusinessDay('2026-08-01', 21)).toBe('2026-08-31');
    });

    it('recusa n fora de faixa', () => {
      expect(() => nthBusinessDay('2026-09-01', 0)).toThrow();
    });
  });

  describe('lastBusinessDay', () => {
    it('volta para sexta quando o mes termina no fim de semana', () => {
      expect(lastBusinessDay('2026-05-01')).toBe('2026-05-29');
      expect(lastBusinessDay('2026-02-01')).toBe('2026-02-27');
    });

    it('mantem o ultimo dia do mes quando ele cai em dia util', () => {
      expect(lastBusinessDay('2026-08-01')).toBe('2026-08-31');
    });
  });

  describe('shiftToBusinessDay', () => {
    it('nao mexe em data que cai em dia util', () => {
      expect(shiftToBusinessDay('2026-09-04', 'previous')).toBe('2026-09-04');
      expect(shiftToBusinessDay('2026-09-04', 'next')).toBe('2026-09-04');
    });

    it('antecipa sabado e domingo para sexta', () => {
      expect(shiftToBusinessDay('2026-09-05', 'previous')).toBe('2026-09-04');
      expect(shiftToBusinessDay('2026-09-06', 'previous')).toBe('2026-09-04');
    });

    it('posterga sabado e domingo para segunda', () => {
      expect(shiftToBusinessDay('2026-09-05', 'next')).toBe('2026-09-07');
      expect(shiftToBusinessDay('2026-09-06', 'next')).toBe('2026-09-07');
    });

    it('atravessa a virada do mes quando precisa', () => {
      expect(shiftToBusinessDay('2026-11-01', 'previous')).toBe('2026-10-30');
      expect(shiftToBusinessDay('2026-02-28', 'next')).toBe('2026-03-02');
    });

    it('atravessa a virada do ano', () => {
      expect(shiftToBusinessDay('2028-01-01', 'previous')).toBe('2027-12-31');
    });
  });
});

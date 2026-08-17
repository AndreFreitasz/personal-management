import { competenceOf, isCompetence, parseCompetence } from './competence';

describe('competence', () => {
  describe('competenceOf', () => {
    it('reduz um instante ao primeiro dia do mes, em UTC', () => {
      expect(competenceOf(new Date('2026-08-09T14:32:00.000Z'))).toBe('2026-08-01');
    });

    it('mantem o mes do UTC mesmo quando o horario local ja virou', () => {
      expect(competenceOf(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09-01');
    });

    it('zero-padda mes de um digito', () => {
      expect(competenceOf(new Date('2026-01-31T23:59:59.999Z'))).toBe('2026-01-01');
    });
  });

  describe('parseCompetence', () => {
    it('aceita a forma canonica', () => {
      expect(parseCompetence('2026-08')).toBe('2026-08-01');
      expect(parseCompetence('2026-08-01')).toBe('2026-08-01');
    });

    it('normaliza qualquer dia do mes para o primeiro', () => {
      expect(parseCompetence('2026-08-23')).toBe('2026-08-01');
    });

    it('rejeita competencia invalida', () => {
      expect(() => parseCompetence('2026-13')).toThrow();
      expect(() => parseCompetence('agosto/2026')).toThrow();
      expect(() => parseCompetence('2026-02-30')).toThrow();
    });
  });

  describe('isCompetence', () => {
    it('reconhece o formato de armazenamento', () => {
      expect(isCompetence('2026-08-01')).toBe(true);
      expect(isCompetence('2026-08-02')).toBe(false);
      expect(isCompetence('2026-08')).toBe(false);
    });
  });
});

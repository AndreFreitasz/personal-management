import {
  competencesIn,
  monthsBetween,
  PeriodPreset,
  previousPeriod,
  resolvePeriod,
} from './period';

const NOW = new Date('2026-08-13T15:42:07.123Z');

const iso = (date: Date) => date.toISOString();

describe('resolvePeriod', () => {
  it('mes atual vai do primeiro instante ao ultimo do mes', () => {
    const period = resolvePeriod(PeriodPreset.ThisMonth, NOW);

    expect(iso(period.from)).toBe('2026-08-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-08-31T23:59:59.999Z');
  });

  it('mes anterior nao encosta no mes atual', () => {
    const period = resolvePeriod(PeriodPreset.LastMonth, NOW);

    expect(iso(period.from)).toBe('2026-07-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-07-31T23:59:59.999Z');
  });

  it('ultimos 3 meses inclui o corrente e os dois anteriores', () => {
    const period = resolvePeriod(PeriodPreset.Last3Months, NOW);

    expect(iso(period.from)).toBe('2026-06-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-08-31T23:59:59.999Z');
  });

  it('ultimos 12 meses atravessa a virada do ano', () => {
    const period = resolvePeriod(PeriodPreset.Last12Months, NOW);

    expect(iso(period.from)).toBe('2025-09-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-08-31T23:59:59.999Z');
  });

  it('o ano vai de 1 de janeiro a 31 de dezembro', () => {
    const period = resolvePeriod(PeriodPreset.ThisYear, NOW);

    expect(iso(period.from)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-12-31T23:59:59.999Z');
  });

  it('fevereiro de ano bissexto termina no dia 29', () => {
    const period = resolvePeriod(PeriodPreset.ThisMonth, new Date('2028-02-10T00:00:00.000Z'));

    expect(iso(period.to)).toBe('2028-02-29T23:59:59.999Z');
  });

  it('mes anterior a janeiro e dezembro do ano passado', () => {
    const period = resolvePeriod(PeriodPreset.LastMonth, new Date('2026-01-05T00:00:00.000Z'));

    expect(iso(period.from)).toBe('2025-12-01T00:00:00.000Z');
    expect(iso(period.to)).toBe('2025-12-31T23:59:59.999Z');
  });

  it('custom respeita as datas informadas', () => {
    const period = resolvePeriod(PeriodPreset.Custom, NOW, {
      from: new Date('2026-03-10T00:00:00.000Z'),
      to: new Date('2026-04-02T23:59:59.999Z'),
    });

    expect(iso(period.from)).toBe('2026-03-10T00:00:00.000Z');
    expect(iso(period.to)).toBe('2026-04-02T23:59:59.999Z');
  });
});

describe('previousPeriod', () => {
  it('de agosto devolve julho inteiro, e nao os 31 dias anteriores', () => {
    const previous = previousPeriod(resolvePeriod(PeriodPreset.ThisMonth, NOW));

    expect(iso(previous.from)).toBe('2026-07-01T00:00:00.000Z');
    expect(iso(previous.to)).toBe('2026-07-31T23:59:59.999Z');
  });

  it('de um trimestre devolve o trimestre anterior', () => {
    const previous = previousPeriod(resolvePeriod(PeriodPreset.Last3Months, NOW));

    expect(iso(previous.from)).toBe('2026-03-01T00:00:00.000Z');
    expect(iso(previous.to)).toBe('2026-05-31T23:59:59.999Z');
  });

  it('recorte livre volta pelo mesmo numero de dias', () => {
    const previous = previousPeriod({
      from: new Date('2026-08-10T00:00:00.000Z'),
      to: new Date('2026-08-19T23:59:59.999Z'),
    });

    expect(iso(previous.from)).toBe('2026-07-31T00:00:00.000Z');
    expect(iso(previous.to)).toBe('2026-08-09T23:59:59.999Z');
  });
});

describe('competencesIn', () => {
  it('lista todas as competencias do recorte, sem buraco', () => {
    const keys = competencesIn(resolvePeriod(PeriodPreset.Last3Months, NOW));

    expect(keys).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('recorte de um mes so devolve uma competencia', () => {
    expect(competencesIn(resolvePeriod(PeriodPreset.ThisMonth, NOW))).toEqual(['2026-08-01']);
  });

  it('recorte parcial ainda devolve o mes que o contem', () => {
    const keys = competencesIn({
      from: new Date('2026-01-20T00:00:00.000Z'),
      to: new Date('2026-02-05T00:00:00.000Z'),
    });

    expect(keys).toEqual(['2026-01-01', '2026-02-01']);
  });
});

describe('monthsBetween', () => {
  it('conta as duas pontas', () => {
    expect(monthsBetween(new Date('2026-06-01T00:00:00Z'), new Date('2026-08-31T23:59:59Z'))).toBe(
      3,
    );
  });

  it('atravessa o ano', () => {
    expect(monthsBetween(new Date('2025-11-01T00:00:00Z'), new Date('2026-02-28T23:59:59Z'))).toBe(
      4,
    );
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { RecurrencesService } from '../src/recurrences/recurrences.service';
import { auth, createTestApp, resetDatabase, TestSession, uniqueEmail } from './helpers';

describe('F1 — recorrencias', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let recurrences: RecurrencesService;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    recurrences = app.get(RecurrencesService);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  const register = async (): Promise<TestSession> => {
    const email = uniqueEmail('recorrencia');
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'senha-forte-123', name: 'Fulano de Tal' })
      .expect(201);

    return {
      userId: response.body.user.id,
      email,
      accessToken: response.body.accessToken,
      refreshToken: response.body.refreshToken,
    };
  };

  const createAccount = async (session: TestSession): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set(...auth(session))
      .send({
        name: 'Conta corrente',
        type: 'checking',
        initialBalance: 0,
        initialBalanceAt: '2025-12-01',
      })
      .expect(201);

    return response.body.id;
  };

  interface MaterializedRow {
    description: string;
    amount: string;
    occurred_at: Date;
    competence: string;
    status: string;
  }

  interface RecurrenceSeed {
    type?: 'credit' | 'debit';
    scheduleType?: 'day_of_month' | 'fifth_business_day' | 'last_business_day';
    dayOfMonth?: number | null;
    adjustment?: 'none' | 'previous_business_day' | 'next_business_day';
    startsOn?: string;
    endsOn?: string | null;
    installments?: number | null;
    amount?: number;
    createdAt?: string;
  }

  const seedRecurrence = async (
    session: TestSession,
    accountId: string,
    seed: RecurrenceSeed = {},
  ): Promise<string> => {
    const {
      type = 'credit',
      scheduleType = 'day_of_month',
      dayOfMonth = 5,
      adjustment = 'none',
      startsOn = '2026-01-01',
      endsOn = null,
      installments = null,
      amount = 5000,
      createdAt = '2026-01-01T00:00:00.000Z',
    } = seed;

    const [{ id }] = await dataSource.query(
      `INSERT INTO "recurrences"
         ("user_id","account_id","type","description","schedule_type","day_of_month",
          "adjustment","starts_on","ends_on","installments","created_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING "id"`,
      [
        session.userId,
        accountId,
        type,
        type === 'credit' ? 'Salario' : 'Aluguel',
        scheduleType,
        dayOfMonth,
        adjustment,
        startsOn,
        endsOn,
        installments,
        createdAt,
      ],
    );

    await dataSource.query(
      `INSERT INTO "recurrence_amounts" ("recurrence_id","amount","valid_from")
       VALUES ($1,$2,$3)`,
      [id, amount, startsOn],
    );

    return id;
  };

  const listTransactions = (userId: string) =>
    dataSource.query<MaterializedRow[]>(
      `SELECT "description","amount","occurred_at","competence"::text AS "competence","status"
         FROM "transactions" WHERE "user_id" = $1 ORDER BY "competence"`,
      [userId],
    );

  it('materializa uma competencia por mes, e roda duas vezes sem duplicar', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, { dayOfMonth: 10 });

    const now = new Date('2026-03-20T12:00:00.000Z');

    const first = await recurrences.materializeDue(now);
    expect(first.created).toBe(3);

    const second = await recurrences.materializeDue(now);
    expect(second.created).toBe(0);

    const rows = await listTransactions(session.userId);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.competence)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('clampa dia 31 para o ultimo dia de fevereiro', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, { dayOfMonth: 31, startsOn: '2026-02-01' });

    await recurrences.materializeDue(new Date('2026-02-20T12:00:00.000Z'));

    const [row] = await listTransactions(session.userId);
    expect(row.occurred_at.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(row.competence).toBe('2026-02-01');
  });

  it('antecipa para a sexta quando o dia cai no fim de semana', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, {
      dayOfMonth: 5,
      adjustment: 'previous_business_day',
      startsOn: '2026-09-01',
    });

    await recurrences.materializeDue(new Date('2026-09-20T12:00:00.000Z'));

    const [row] = await listTransactions(session.userId);
    expect(row.occurred_at.toISOString()).toBe('2026-09-04T00:00:00.000Z');
  });

  it('nao retroage antes do cadastro', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, {
      startsOn: '2026-05-01',
      createdAt: '2026-08-10T00:00:00.000Z',
    });

    await recurrences.materializeDue(new Date('2026-09-20T12:00:00.000Z'));

    const rows = await listTransactions(session.userId);
    expect(rows.map((r) => r.competence)).toEqual(['2026-08-01', '2026-09-01']);
  });

  it('encerra o parcelamento sozinho na ultima parcela, com contador na descricao', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, {
      type: 'debit',
      installments: 12,
      amount: 200,
      startsOn: '2026-01-01',
    });

    await recurrences.materializeDue(new Date('2027-06-20T12:00:00.000Z'));

    const rows = await listTransactions(session.userId);
    expect(rows).toHaveLength(12);
    expect(rows[0].description).toBe('Aluguel (1/12)');
    expect(rows[11].description).toBe('Aluguel (12/12)');
    expect(rows[11].competence).toBe('2026-12-01');
  });

  it('respeita o reajuste sem reescrever o passado', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    const recurrenceId = await seedRecurrence(session, accountId, { amount: 5000 });

    await dataSource.query(
      `INSERT INTO "recurrence_amounts" ("recurrence_id","amount","valid_from")
       VALUES ($1,$2,$3)`,
      [recurrenceId, 5500, '2026-05-01'],
    );

    await recurrences.materializeDue(new Date('2026-06-20T12:00:00.000Z'));

    const rows = await listTransactions(session.userId);
    const porCompetencia = new Map(rows.map((r) => [r.competence, r.amount]));
    expect(porCompetencia.get('2026-04-01')).toBe('5000.00');
    expect(porCompetencia.get('2026-05-01')).toBe('5500.00');
    expect(porCompetencia.get('2026-06-01')).toBe('5500.00');
  });

  it('nao gera nada enquanto pausada, e preserva o que ja existe', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    const recurrenceId = await seedRecurrence(session, accountId);

    await recurrences.materializeDue(new Date('2026-02-20T12:00:00.000Z'));
    expect(await listTransactions(session.userId)).toHaveLength(2);

    await dataSource.query(`UPDATE "recurrences" SET "paused_at" = now() WHERE "id" = $1`, [
      recurrenceId,
    ]);

    await recurrences.materializeDue(new Date('2026-06-20T12:00:00.000Z'));
    expect(await listTransactions(session.userId)).toHaveLength(2);
  });

  it('gasto recorrente nasce pendente e fica fora do saldo realizado', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId, { type: 'debit', amount: 200 });

    await recurrences.materializeDue(new Date('2026-01-20T12:00:00.000Z'));

    const [row] = await listTransactions(session.userId);
    expect(row.status).toBe('pending');

    await request(app.getHttpServer())
      .get('/api/accounts/wallet')
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.balance).toBe(0));

    await dataSource.query(`UPDATE "transactions" SET "status" = 'paid' WHERE "user_id" = $1`, [
      session.userId,
    ]);

    await request(app.getHttpServer())
      .get('/api/accounts/wallet')
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.balance).toBe(-200));
  });

  it('a lapide sobrevive ao lancamento apagado, e o job nao o ressuscita', async () => {
    const session = await register();
    const accountId = await createAccount(session);
    await seedRecurrence(session, accountId);

    await recurrences.materializeDue(new Date('2026-01-20T12:00:00.000Z'));
    await dataSource.query(`DELETE FROM "transactions" WHERE "user_id" = $1`, [session.userId]);

    const [tombstone] = await dataSource.query(
      `SELECT "transaction_id" FROM "generated_transactions"`,
    );
    expect(tombstone.transaction_id).toBeNull();

    await recurrences.materializeDue(new Date('2026-01-20T12:00:00.000Z'));
    expect(await listTransactions(session.userId)).toHaveLength(0);
  });

  describe('o banco recusa recorrencia malformada', () => {
    const insert = (session: TestSession, accountId: string, columns: string, values: unknown[]) =>
      dataSource.query(
        `INSERT INTO "recurrences"
           ("user_id","account_id","type","description","adjustment","starts_on",${columns})
         VALUES ($1,$2,'credit','Salario','none','2026-01-01',${values
           .map((_, i) => `$${i + 3}`)
           .join(',')})`,
        [session.userId, accountId, ...values],
      );

    it('recusa dia do mes em agendamento por dia util', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      await expect(
        insert(session, accountId, `"schedule_type","day_of_month"`, ['fifth_business_day', 5]),
      ).rejects.toThrow(/ck_recurrences_day_of_month/);
    });

    it('recusa dia fixo sem dia do mes', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      await expect(
        insert(session, accountId, `"schedule_type","day_of_month"`, ['day_of_month', null]),
      ).rejects.toThrow(/ck_recurrences_day_of_month/);
    });

    it('recusa parcelamento junto de data final', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      await expect(
        insert(session, accountId, `"schedule_type","day_of_month","installments","ends_on"`, [
          'day_of_month',
          5,
          12,
          '2026-12-01',
        ]),
      ).rejects.toThrow(/ck_recurrences_end_single_source/);
    });

    it('recusa competencia que nao e o primeiro dia do mes', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      await expect(
        dataSource.query(
          `INSERT INTO "recurrences"
             ("user_id","account_id","type","description","schedule_type","day_of_month",
              "adjustment","starts_on")
           VALUES ($1,$2,'credit','Salario','day_of_month',5,'none','2026-01-15')`,
          [session.userId, accountId],
        ),
      ).rejects.toThrow(/ck_recurrences_competence_shape/);
    });

    it('recusa valor negativo', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const id = await seedRecurrence(session, accountId);
      await expect(
        dataSource.query(
          `INSERT INTO "recurrence_amounts" ("recurrence_id","amount","valid_from")
           VALUES ($1,-100,'2026-06-01')`,
          [id],
        ),
      ).rejects.toThrow(/ck_recurrence_amounts_positive/);
    });

    it('recusa duas competencias iguais na mesma recorrencia', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      await seedRecurrence(session, accountId);

      await recurrences.materializeDue(new Date('2026-01-20T12:00:00.000Z'));

      const [{ id: recurrenceId }] = await dataSource.query(
        `SELECT "id" FROM "recurrences" LIMIT 1`,
      );

      await expect(
        dataSource.query(
          `INSERT INTO "generated_transactions" ("recurrence_id","competence")
           VALUES ($1,'2026-01-01')`,
          [recurrenceId],
        ),
      ).rejects.toThrow(/uq_generated_transactions_slot/);
    });
  });
});

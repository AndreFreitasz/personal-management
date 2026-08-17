import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { auth, createTestApp, resetDatabase, TestSession, uniqueEmail } from './helpers';

describe('F1 — API de recorrencias', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
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
    const email = uniqueEmail('recorrencia-api');
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

  const createAccount = async (session: TestSession, name = 'Conta corrente'): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/accounts')
      .set(...auth(session))
      .send({ name, type: 'checking', initialBalance: 0, initialBalanceAt: '2025-12-01' })
      .expect(201);
    return response.body.id;
  };

  const competenceIn = (months: number): string => {
    const now = new Date();
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 1));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const currentCompetence = (): string => competenceIn(0);
  const nextCompetence = (): string => competenceIn(1);

  const salario = (accountId: string) => ({
    type: 'credit',
    description: 'Salario',
    amount: 5000,
    accountId,
    scheduleType: 'fifth_business_day',
    startsOn: '2026-01',
  });

  it('cadastra renda e devolve o recurso com valor vigente', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send(salario(accountId))
      .expect(201)
      .expect((res) => {
        expect(res.body.amount).toBe(5000);
        expect(res.body.startsOn).toBe('2026-01');
        expect(res.body.paused).toBe(false);
        expect(res.body.adjustment).toBe('previous_business_day');
        expect(res.body.dayOfMonth).toBeNull();
      });
  });

  it('aplica o ajuste padrao oposto em gasto fixo', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({
        type: 'debit',
        description: 'Aluguel',
        amount: 1800,
        accountId,
        scheduleType: 'day_of_month',
        dayOfMonth: 10,
        startsOn: '2026-01',
      })
      .expect(201)
      .expect((res) => expect(res.body.adjustment).toBe('next_business_day'));
  });

  describe('validacao', () => {
    it('recusa dia fixo sem dayOfMonth', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), scheduleType: 'day_of_month' })
        .expect(400);
    });

    it('recusa dayOfMonth em agendamento por dia util', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), dayOfMonth: 5 })
        .expect(400);
    });

    it('recusa parcelamento junto de data final', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), endsOn: '2026-12', installments: 12 })
        .expect(400);
    });

    it('recusa transferencia como recorrencia', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const destinoId = await createAccount(session, 'Investimentos');

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), type: 'transfer', destinationAccountId: destinoId })
        .expect(400)
        .expect((res) => expect(String(res.body.message)).toMatch(/nao pode ser recorrente/i));

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), type: 'transfer' })
        .expect(400);
    });

    it('aceita aporte mensal como saida com categoria Investimento', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const categories = await request(app.getHttpServer())
        .get('/api/categories')
        .set(...auth(session))
        .expect(200);
      const investimento = categories.body.find((c: { name: string }) => c.name === 'Investimento');
      expect(investimento.kind).toBe('expense');

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({
          type: 'debit',
          description: 'Aporte mensal',
          amount: 1000,
          accountId,
          categoryId: investimento.id,
          scheduleType: 'day_of_month',
          dayOfMonth: 5,
          startsOn: '2026-01',
        })
        .expect(201);
    });

    it('recusa valor negativo e competencia malformada', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), amount: -100 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), startsOn: '2026-01-05' })
        .expect(400);
    });

    it('recusa categoria de tipo incompativel', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const categories = await request(app.getHttpServer())
        .get('/api/categories')
        .set(...auth(session))
        .expect(200);
      const expense = categories.body.find((c: { kind: string }) => c.kind === 'expense');

      await request(app.getHttpServer())
        .post('/api/recurrences')
        .set(...auth(session))
        .send({ ...salario(accountId), categoryId: expense.id })
        .expect(400);
    });
  });

  it('nao deixa um usuario ver nem mexer na recorrencia do outro', async () => {
    const dono = await register();
    const accountId = await createAccount(dono);
    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(dono))
      .send(salario(accountId))
      .expect(201);

    const intruso = await register();

    await request(app.getHttpServer())
      .get(`/api/recurrences/${created.body.id}`)
      .set(...auth(intruso))
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/pause`)
      .set(...auth(intruso))
      .send({})
      .expect(404);
  });

  it('mostra a previa dos proximos 12, com data ajustada e parcela', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({
        type: 'debit',
        description: 'Notebook',
        amount: 200,
        accountId,
        scheduleType: 'day_of_month',
        dayOfMonth: 5,
        adjustment: 'previous_business_day',
        startsOn: '2026-09',
        installments: 12,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/recurrences/${created.body.id}/preview`)
      .set(...auth(session))
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(12);
        expect(res.body[0]).toMatchObject({
          competence: '2026-09-01',
          occursOn: '2026-09-04',
          amount: 200,
          installment: 1,
          materialized: false,
        });
        expect(res.body[11].installment).toBe(12);
      });
  });

  it('reajusta sem reescrever o passado e reflete o valor vigente', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send(salario(accountId))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/adjust`)
      .set(...auth(session))
      .send({ amount: 5500, validFrom: '2026-05' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/recurrences/${created.body.id}/preview`)
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body[0].amount).toBe(5500));

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/adjust`)
      .set(...auth(session))
      .send({ amount: 4000, validFrom: '2025-01' })
      .expect(400);
  });

  it('pausa e retoma pelo mesmo interruptor', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send(salario(accountId))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/pause`)
      .set(...auth(session))
      .send({})
      .expect(201)
      .expect((res) => expect(res.body.paused).toBe(true));

    await request(app.getHttpServer())
      .get('/api/recurrences')
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(0));

    await request(app.getHttpServer())
      .get('/api/recurrences?includePaused=true')
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(1));

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/pause`)
      .set(...auth(session))
      .send({ paused: false })
      .expect(201)
      .expect((res) => expect(res.body.paused).toBe(false));
  });

  it('materializa a competencia corrente no cadastro, e a projecao ja conta com ela', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({
        type: 'debit',
        description: 'Viagem',
        amount: 125,
        accountId,
        scheduleType: 'day_of_month',
        dayOfMonth: 10,
        startsOn: currentCompetence(),
      })
      .expect(201);

    expect(created.body.materializedCount).toBe(1);

    await request(app.getHttpServer())
      .get('/api/dashboard/projection')
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.scheduledExpense).toBe(125));
  });

  it('gera os meses anteriores so quando pedido explicitamente', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const created = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({ ...salario(accountId), startsOn: '2026-01' })
      .expect(201);

    expect(created.body.materializedCount).toBe(1);

    const filled = await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/backfill`)
      .set(...auth(session))
      .expect(200);

    expect(filled.body.created).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(`/api/recurrences/${created.body.id}`)
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.materializedCount).toBe(filled.body.created + 1));

    await request(app.getHttpServer())
      .post(`/api/recurrences/${created.body.id}/backfill`)
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.created).toBe(0));
  });

  it('recorrencia tambem segura a exclusao da categoria, e e realocada junto', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    const { body: categories } = await request(app.getHttpServer())
      .get('/api/categories')
      .set(...auth(session))
      .expect(200);

    const salarioCat = categories.find((c: { name: string }) => c.name === 'Salário');

    const { body: recurrence } = await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({ ...salario(accountId), categoryId: salarioCat.id, startsOn: nextCompetence() })
      .expect(201);

    const { body: usage } = await request(app.getHttpServer())
      .get(`/api/categories/${salarioCat.id}/usage`)
      .set(...auth(session))
      .expect(200);

    expect(usage.transactionCount).toBe(0);
    expect(usage.recurrenceCount).toBe(1);
    expect(usage.recurrences[0].description).toBe('Salario');

    await request(app.getHttpServer())
      .delete(`/api/categories/${salarioCat.id}`)
      .set(...auth(session))
      .send({})
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/categories/${salarioCat.id}`)
      .set(...auth(session))
      .send({ reassignToId: null })
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/recurrences/${recurrence.id}`)
      .set(...auth(session))
      .expect(200)
      .expect((res) => expect(res.body.categoryId).toBeNull());
  });

  it('recusa campo nao declarado, pelo whitelist do ValidationPipe', async () => {
    const session = await register();
    const accountId = await createAccount(session);

    await request(app.getHttpServer())
      .post('/api/recurrences')
      .set(...auth(session))
      .send({ ...salario(accountId), pausedAt: '2026-01-01T00:00:00.000Z' })
      .expect(400);
  });
});

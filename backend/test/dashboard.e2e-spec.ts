import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, resetDatabase, TestSession, uniqueEmail } from './helpers';

describe('F4 — dashboard (E9)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  const register = async (): Promise<TestSession> => {
    const email = uniqueEmail('painel');
    const { body } = await request(http)
      .post('/api/auth/register')
      .send({ email, password: 'senha-forte-123', name: 'Titular' })
      .expect(201);

    return {
      userId: body.user.id,
      email,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  };

  const bearer = (session: TestSession) => ({ Authorization: `Bearer ${session.accessToken}` });

  const createAccount = async (session: TestSession, name = 'Conta'): Promise<string> => {
    const { body } = await request(http)
      .post('/api/accounts')
      .set(bearer(session))
      .send({
        name: `${name} ${Math.random().toString(36).slice(2, 8)}`,
        type: 'checking',
        initialBalance: 0,
        initialBalanceAt: '2020-01-01',
      })
      .expect(201);
    return body.id;
  };

  const categoriesOf = async (session: TestSession) => {
    const { body } = await request(http).get('/api/categories').set(bearer(session)).expect(200);
    return body as Array<{ id: string; name: string; kind: string }>;
  };

  const post = async (
    session: TestSession,
    body: Record<string, unknown>,
  ): Promise<{ id: string }> => {
    const response = await request(http)
      .post('/api/transactions')
      .set(bearer(session))
      .send(body)
      .expect(201);
    return response.body;
  };

  const get = async (session: TestSession, path: string, query = '') => {
    const response = await request(http)
      .get(`/api/dashboard/${path}${query}`)
      .set(bearer(session))
      .expect(200);
    return response.body;
  };

  const thisMonth = (day: number, hour = 12): string => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour)).toISOString();
  };

  const lastMonth = (day: number): string => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, 12)).toISOString();
  };

  const scenario = async () => {
    const session = await register();
    const accountId = await createAccount(session);
    const categories = await categoriesOf(session);
    const id = (name: string) => categories.find((c) => c.name === name)!.id;

    await post(session, {
      type: 'credit',
      amount: 3000,
      description: 'Salario',
      occurredAt: thisMonth(1),
      accountId,
      categoryId: id('Salário'),
    });
    await post(session, {
      type: 'debit',
      amount: 800,
      description: 'Aluguel',
      occurredAt: thisMonth(2),
      accountId,
      categoryId: id('Moradia'),
    });
    await post(session, {
      type: 'debit',
      amount: 200,
      description: 'Mercado',
      occurredAt: thisMonth(3),
      accountId,
      categoryId: id('Alimentação'),
    });
    await post(session, {
      type: 'debit',
      amount: 100,
      description: 'Onibus',
      occurredAt: thisMonth(4),
      accountId,
      categoryId: id('Transporte'),
    });
    await post(session, {
      type: 'credit',
      amount: 2000,
      description: 'Salario anterior',
      occurredAt: lastMonth(5),
      accountId,
      categoryId: id('Salário'),
    });
    await post(session, {
      type: 'debit',
      amount: 500,
      description: 'Aluguel anterior',
      occurredAt: lastMonth(6),
      accountId,
      categoryId: id('Moradia'),
    });

    return { session, accountId, id };
  };

  describe('resumo', () => {
    it('soma entradas e saidas do mes e devolve a variacao contra o anterior', async () => {
      const { session } = await scenario();
      const body = await get(session, 'summary');

      expect(body.income).toBe(3000);
      expect(body.expense).toBe(1100);
      expect(body.net).toBe(1900);
      expect(body.count).toBe(4);
      expect(body.previous).toEqual({ income: 2000, expense: 500, net: 1500 });
      expect(body.savingsRate).toBeCloseTo(0.6333, 4);
    });

    it('mes sem lancamento devolve zero, e nao erro nem null', async () => {
      const session = await register();
      const body = await get(session, 'summary');

      expect(body).toMatchObject({ income: 0, expense: 0, net: 0, count: 0 });
      expect(body.savingsRate).toBeNull();
    });

    it('transferencia entre contas proprias nao entra em entradas nem em saidas', async () => {
      const session = await register();
      const origem = await createAccount(session, 'Origem');
      const destino = await createAccount(session, 'Destino');

      await post(session, {
        type: 'transfer',
        amount: 700,
        description: 'Para a poupanca',
        occurredAt: thisMonth(5),
        accountId: origem,
        destinationAccountId: destino,
      });

      const body = await get(session, 'summary');
      expect(body).toMatchObject({ income: 0, expense: 0, net: 0 });
      expect(body.count).toBe(1);
    });

    it('lancamento futuro e pendente ficam fora do realizado', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const now = new Date();
      const future = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 10, 12),
      ).toISOString();

      await post(session, {
        type: 'debit',
        amount: 90,
        description: 'Agendado',
        occurredAt: future,
        accountId,
      });

      const body = await get(session, 'summary', '?period=custom&from=' + future + '&to=' + future);
      expect(body.expense).toBe(0);
    });

    it('recusa periodo desconhecido com 400', async () => {
      const session = await register();
      await request(http)
        .get('/api/dashboard/summary?period=ontem')
        .set(bearer(session))
        .expect(400);
    });

    it('exige autenticacao', async () => {
      await request(http).get('/api/dashboard/summary').expect(401);
    });
  });

  describe('gastos por categoria', () => {
    it('soma so as saidas, ordenadas da maior para a menor', async () => {
      const { session } = await scenario();
      const body = await get(session, 'by-category');

      expect(body.total).toBe(1100);
      expect(body.slices.map((s: { name: string }) => s.name)).toEqual([
        'Moradia',
        'Alimentação',
        'Transporte',
      ]);
      expect(body.slices[0]).toMatchObject({ total: 800, count: 1 });
      expect(body.slices[0].share).toBeCloseTo(800 / 1100, 6);
      expect(body.slices.some((s: { name: string }) => s.name === 'Salário')).toBe(false);
    });

    it('gasto sem categoria aparece como fatia propria, e nao some', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await post(session, {
        type: 'debit',
        amount: 45,
        description: 'Sem classificar',
        occurredAt: thisMonth(7),
        accountId,
      });

      const body = await get(session, 'by-category');
      expect(body.total).toBe(45);
      expect(body.slices).toHaveLength(1);
      expect(body.slices[0]).toMatchObject({ categoryId: null, name: 'Sem categoria', total: 45 });
    });

    it('gasto em subcategoria soma dentro da categoria mae', async () => {
      const { session, id } = await scenario();
      const accountId = await createAccount(session, 'Extra');

      const { body: padaria } = await request(http)
        .post('/api/categories')
        .set(bearer(session))
        .send({ name: 'Padaria', kind: 'expense', parentId: id('Alimentação') })
        .expect(201);

      await post(session, {
        type: 'debit',
        amount: 30,
        description: 'Pao',
        occurredAt: thisMonth(9),
        accountId,
        categoryId: padaria.id,
      });

      const body = await get(session, 'by-category');

      const alimentacao = body.slices.find((s: { name: string }) => s.name === 'Alimentação');
      expect(alimentacao).toMatchObject({ total: 230, count: 2 });
      expect(body.slices.some((s: { name: string }) => s.name === 'Padaria')).toBe(false);
      expect(body.total).toBe(1130);

      expect(alimentacao.children).toEqual([
        expect.objectContaining({ categoryId: null, name: null, total: 200, count: 1 }),
        expect.objectContaining({ categoryId: padaria.id, name: 'Padaria', total: 30, count: 1 }),
      ]);
      expect(alimentacao.children[1].share).toBeCloseTo(30 / 230, 6);
    });

    it('categoria sem filhas devolve um balde so, o de "nenhuma subcategoria"', async () => {
      const { session } = await scenario();
      const body = await get(session, 'by-category');

      const moradia = body.slices.find((s: { name: string }) => s.name === 'Moradia');
      expect(moradia.children).toEqual([
        expect.objectContaining({ categoryId: null, total: 800, count: 1, share: 1 }),
      ]);
    });

    it('orcamento mensal e multiplicado pelos meses do recorte', async () => {
      const { session, id } = await scenario();

      await request(http)
        .patch(`/api/categories/${id('Moradia')}`)
        .set(bearer(session))
        .send({ monthlyBudget: 900 })
        .expect(200);

      const mes = await get(session, 'by-category');
      const moradiaMes = mes.slices.find((s: { name: string }) => s.name === 'Moradia');
      expect(moradiaMes.budget).toBe(900);

      const trimestre = await get(session, 'by-category', '?period=last-3-months');
      const moradiaTri = trimestre.slices.find((s: { name: string }) => s.name === 'Moradia');
      expect(moradiaTri.budget).toBe(2700);
    });
  });

  describe('series', () => {
    it('a serie diaria cobre todos os dias do mes, inclusive os vazios', async () => {
      const { session } = await scenario();
      const body = await get(session, 'balance-series');

      const now = new Date();
      const daysInMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
      ).getUTCDate();
      expect(body.points).toHaveLength(daysInMonth);

      expect(body.points[0]).toMatchObject({ net: 3000, cumulative: 3000 });
      expect(body.points[1]).toMatchObject({ net: -800, cumulative: 2200 });
      expect(body.points[4]).toMatchObject({ net: 0, cumulative: 1900 });
      expect(body.points[body.points.length - 1].cumulative).toBe(1900);
    });

    it('o comparativo agrupa por competencia e devolve todo mes do recorte', async () => {
      const { session } = await scenario();
      const body = await get(session, 'monthly-comparison', '?period=last-3-months');

      expect(body.months).toHaveLength(3);
      expect(body.months[1]).toMatchObject({ income: 2000, expense: 500, net: 1500 });
      expect(body.months[2]).toMatchObject({ income: 3000, expense: 1100, net: 1900 });
      expect(body.months[0]).toMatchObject({ income: 0, expense: 0, net: 0 });
    });

    it('o top de destinatarios soma repeticoes da mesma descricao', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      for (const [description, amount] of [
        ['Mercado do Ze', 60],
        ['Mercado do Ze', 40],
        [' Mercado do Ze ', 25],
        ['Farmacia', 80],
      ] as const) {
        await post(session, {
          type: 'debit',
          amount,
          description,
          occurredAt: thisMonth(8),
          accountId,
        });
      }

      const body = await get(session, 'top-merchants');

      expect(body.merchants).toEqual([
        { description: 'Mercado do Ze', total: 125, count: 3 },
        { description: 'Farmacia', total: 80, count: 1 },
      ]);
    });

    it('a projecao soma o agendado ao saldo de hoje', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const now = new Date();
      const daysInMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
      ).getUTCDate();

      await post(session, {
        type: 'credit',
        amount: 1000,
        description: 'Ja caiu',
        occurredAt: thisMonth(1, 0),
        accountId,
      });

      await post(session, {
        type: 'debit',
        amount: 250,
        description: 'Conta de luz',
        occurredAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), daysInMonth, 23),
        ).toISOString(),
        accountId,
      });

      const body = await get(session, 'projection');

      expect(body.balance).toBe(1000);
      expect(body.scheduledExpense).toBe(250);
      expect(body.projected).toBe(750);
    });
  });

  describe('um filtro, todos os widgets', () => {
    it('excluir uma categoria some com ela do cartao, do grafico e da serie', async () => {
      const { session, id } = await scenario();
      const query = `?excludeCategoryId=${id('Moradia')}`;

      const [summary, byCategory, series] = await Promise.all([
        get(session, 'summary', query),
        get(session, 'by-category', query),
        get(session, 'balance-series', query),
      ]);

      expect(summary.expense).toBe(300);
      expect(byCategory.total).toBe(300);
      expect(byCategory.slices.some((s: { name: string }) => s.name === 'Moradia')).toBe(false);
      expect(series.points[series.points.length - 1].cumulative).toBe(2700);
    });

    it('o total do cartao e a soma das fatias sao o mesmo numero', async () => {
      const { session } = await scenario();
      const query = '?period=last-3-months';

      const [summary, byCategory] = await Promise.all([
        get(session, 'summary', query),
        get(session, 'by-category', query),
      ]);

      const soma = byCategory.slices.reduce(
        (total: number, slice: { total: number }) => total + slice.total,
        0,
      );

      expect(soma).toBe(summary.expense);
      expect(byCategory.total).toBe(summary.expense);
    });

    it('a busca textual recorta os cinco widgets pelo mesmo criterio', async () => {
      const { session } = await scenario();
      const query = '?search=mercado';

      const [summary, byCategory] = await Promise.all([
        get(session, 'summary', query),
        get(session, 'by-category', query),
      ]);

      expect(summary.expense).toBe(200);
      expect(summary.count).toBe(1);
      expect(byCategory.slices).toHaveLength(1);
      expect(byCategory.slices[0].name).toBe('Alimentação');
    });

    it('nao mistura o dado de outro usuario', async () => {
      const { session } = await scenario();
      const intruso = await register();

      const body = await get(intruso, 'summary');
      expect(body).toMatchObject({ income: 0, expense: 0, count: 0 });

      expect((await get(session, 'summary')).income).toBe(3000);
    });
  });

  describe('serie diaria com entradas e saidas', () => {
    it('separa entrada e saida em cada dia, e o dia sem lancamento vem zerado', async () => {
      const { session } = await scenario();
      const body = await get(session, 'balance-series');

      const day = (n: number) =>
        body.points.find((point: { date: string }) => Number(point.date.slice(8, 10)) === n) as {
          income: number;
          expense: number;
          net: number;
        };

      expect(day(1)).toMatchObject({ income: 3000, expense: 0, net: 3000 });
      expect(day(2)).toMatchObject({ income: 0, expense: 800, net: -800 });
      expect(day(3)).toMatchObject({ income: 0, expense: 200, net: -200 });

      expect(day(5)).toMatchObject({ income: 0, expense: 0, net: 0 });
    });

    it('a soma dos dias e a mesma do resumo e a do mes a mes', async () => {
      const { session } = await scenario();
      const [summary, series, monthly] = await Promise.all([
        get(session, 'summary'),
        get(session, 'balance-series'),
        get(session, 'monthly-comparison'),
      ]);

      const soma = (campo: 'income' | 'expense') =>
        series.points.reduce(
          (total: number, point: Record<string, number>) => total + point[campo],
          0,
        );

      expect(soma('income')).toBe(summary.income);
      expect(soma('expense')).toBe(summary.expense);

      const mes = monthly.months[monthly.months.length - 1];
      expect(mes).toMatchObject({ income: summary.income, expense: summary.expense });
    });

    it('transferencia nao vira entrada nem saida do dia', async () => {
      const session = await register();
      const origem = await createAccount(session, 'Origem');
      const destino = await createAccount(session, 'Destino');

      await post(session, {
        type: 'transfer',
        amount: 700,
        description: 'Para a poupanca',
        occurredAt: thisMonth(5),
        accountId: origem,
        destinationAccountId: destino,
      });

      const body = await get(session, 'balance-series');
      const dia = body.points.find(
        (point: { date: string }) => Number(point.date.slice(8, 10)) === 5,
      );

      expect(dia).toMatchObject({ income: 0, expense: 0, net: 0 });
    });
  });

  describe('lancamentos de um dia', () => {
    const dayOf = (n: number) => thisMonth(n).slice(0, 10);

    it('lista o dia clicado e os totais batem com a coluna daquele dia', async () => {
      const { session } = await scenario();
      const [dia, series] = await Promise.all([
        get(session, 'day', `?date=${dayOf(2)}`),
        get(session, 'balance-series'),
      ]);

      const coluna = series.points.find((point: { date: string }) => point.date === dayOf(2));

      expect(dia).toMatchObject({ date: dayOf(2), income: 0, expense: 800, count: 1 });
      expect(dia.income).toBe(coluna.income);
      expect(dia.expense).toBe(coluna.expense);
      expect(dia.transactions).toHaveLength(1);
      expect(dia.transactions[0]).toMatchObject({
        description: 'Aluguel',
        amount: 800,
        type: 'debit',
        categoryName: 'Moradia',
      });
    });

    it('resolve o nome da conta e da categoria, e a marca do banco', async () => {
      const session = await register();
      const { body: conta } = await request(http)
        .post('/api/accounts')
        .set(bearer(session))
        .send({
          name: 'Cartao Roxo',
          type: 'credit_card',
          initialBalance: 0,
          initialBalanceAt: '2020-01-01',
          icon: 'nubank',
        })
        .expect(201);

      await post(session, {
        type: 'debit',
        amount: 42,
        description: 'Padaria',
        occurredAt: thisMonth(3),
        accountId: conta.id,
      });

      const dia = await get(session, 'day', `?date=${dayOf(3)}`);

      expect(dia.transactions[0]).toMatchObject({
        accountName: 'Cartao Roxo',
        accountIcon: 'nubank',
        categoryId: null,
        categoryName: null,
      });
    });

    it('ordena do maior para o menor: a primeira linha explica a coluna', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      for (const [amount, description] of [
        [30, 'Cafe'],
        [400, 'Notebook'],
        [70, 'Mercado'],
      ] as Array<[number, string]>) {
        await post(session, {
          type: 'debit',
          amount,
          description,
          occurredAt: thisMonth(4),
          accountId,
        });
      }

      const dia = await get(session, 'day', `?date=${dayOf(4)}`);

      expect(dia.transactions.map((t: { description: string }) => t.description)).toEqual([
        'Notebook',
        'Mercado',
        'Cafe',
      ]);
      expect(dia.expense).toBe(500);
    });

    it('respeita o filtro do painel: a lista nunca mostra o que a coluna nao somou', async () => {
      const { session, id } = await scenario();
      const dia = await get(session, 'day', `?date=${dayOf(2)}&excludeCategoryId=${id('Moradia')}`);

      expect(dia).toMatchObject({ expense: 0, count: 0 });
      expect(dia.transactions).toHaveLength(0);
    });

    it('transferencia aparece na lista e fica fora dos totais', async () => {
      const session = await register();
      const origem = await createAccount(session, 'Origem');
      const destino = await createAccount(session, 'Destino');

      await post(session, {
        type: 'transfer',
        amount: 700,
        description: 'Para a poupanca',
        occurredAt: thisMonth(5),
        accountId: origem,
        destinationAccountId: destino,
      });

      const dia = await get(session, 'day', `?date=${dayOf(5)}`);

      expect(dia).toMatchObject({ income: 0, expense: 0, net: 0, count: 1 });
      expect(dia.transactions[0]).toMatchObject({ type: 'transfer', amount: 700 });
    });

    it('dia vazio responde zero e lista vazia, e nao erro', async () => {
      const { session } = await scenario();
      const dia = await get(session, 'day', `?date=${dayOf(6)}`);

      expect(dia).toMatchObject({ income: 0, expense: 0, net: 0, count: 0 });
      expect(dia.transactions).toEqual([]);
    });

    it('recusa data fora do formato AAAA-MM-DD com 400', async () => {
      const session = await register();

      await request(http)
        .get('/api/dashboard/day?date=02/08/2026')
        .set(bearer(session))
        .expect(400);

      await request(http).get('/api/dashboard/day').set(bearer(session)).expect(400);
    });

    it('nao mostra o dia de outro usuario', async () => {
      const { session } = await scenario();
      const intruso = await register();

      expect(await get(intruso, 'day', `?date=${dayOf(2)}`)).toMatchObject({
        expense: 0,
        count: 0,
      });
      expect((await get(session, 'day', `?date=${dayOf(2)}`)).expense).toBe(800);
    });
  });

  describe('comparativo entre contas e cartoes', () => {
    const cartoes = async () => {
      const session = await register();
      const nubank = await createAccount(session, 'Cartao Roxo');
      const itau = await createAccount(session, 'Cartao Laranja');
      const parado = await createAccount(session, 'Cartao Sem Uso');

      await post(session, {
        type: 'debit',
        amount: 300,
        description: 'Mercado',
        occurredAt: thisMonth(2),
        accountId: nubank,
      });
      await post(session, {
        type: 'debit',
        amount: 200,
        description: 'Farmacia',
        occurredAt: thisMonth(3),
        accountId: nubank,
      });
      await post(session, {
        type: 'debit',
        amount: 100,
        description: 'Padaria',
        occurredAt: thisMonth(4),
        accountId: itau,
      });

      return { session, nubank, itau, parado };
    };

    it('ordena os cartoes pela saida do periodo e reparte o total entre eles', async () => {
      const { session, nubank, itau } = await cartoes();
      const body = await get(session, 'by-account');

      expect(body.total).toBe(600);
      expect(body.accounts[0]).toMatchObject({ accountId: nubank, expense: 500, count: 2 });
      expect(body.accounts[1]).toMatchObject({ accountId: itau, expense: 100, count: 1 });
      expect(body.accounts[0].share).toBeCloseTo(500 / 600, 6);

      const soma = body.accounts.reduce(
        (total: number, conta: { expense: number }) => total + conta.expense,
        0,
      );
      expect(soma).toBe((await get(session, 'summary')).expense);
    });

    it('cartao sem uso no periodo aparece com zero, e nao desaparece', async () => {
      const { session, parado } = await cartoes();
      const body = await get(session, 'by-account');

      const sem = body.accounts.find((conta: { accountId: string }) => conta.accountId === parado);
      expect(sem).toMatchObject({ expense: 0, count: 0, share: 0 });
    });

    it('transferencia entre contas proprias nao conta como gasto de nenhuma', async () => {
      const session = await register();
      const origem = await createAccount(session, 'Origem');
      const destino = await createAccount(session, 'Destino');

      await post(session, {
        type: 'transfer',
        amount: 700,
        description: 'Para a poupanca',
        occurredAt: thisMonth(5),
        accountId: origem,
        destinationAccountId: destino,
      });

      const body = await get(session, 'by-account');

      expect(body.total).toBe(0);
      expect(body.accounts.every((conta: { expense: number }) => conta.expense === 0)).toBe(true);
    });

    it('filtrar por um cartao deixa so ele, e a parte dele vira o todo', async () => {
      const { session, nubank } = await cartoes();
      const body = await get(session, 'by-account', `?accountId=${nubank}`);

      expect(body.accounts).toHaveLength(1);
      expect(body.accounts[0]).toMatchObject({ accountId: nubank, expense: 500, share: 1 });
    });

    it('devolve o icone da conta para a tela desenhar a marca', async () => {
      const session = await register();
      const { body: conta } = await request(http)
        .post('/api/accounts')
        .set(bearer(session))
        .send({
          name: 'Nubank',
          type: 'credit_card',
          initialBalance: 0,
          initialBalanceAt: '2020-01-01',
          icon: 'nubank',
        })
        .expect(201);

      const body = await get(session, 'by-account');
      expect(body.accounts[0]).toMatchObject({
        accountId: conta.id,
        icon: 'nubank',
        type: 'credit_card',
      });
    });

    it('nao mistura as contas de outro usuario', async () => {
      const { session } = await cartoes();
      const intruso = await register();

      expect((await get(intruso, 'by-account')).accounts).toHaveLength(0);
      expect((await get(session, 'by-account')).total).toBe(600);
    });
  });
});

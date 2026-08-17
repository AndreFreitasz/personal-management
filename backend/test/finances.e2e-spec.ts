import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { createTestApp, resetDatabase, TestSession, uniqueEmail } from './helpers';

describe('F0 — contas, categorias e lancamentos', () => {
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
    const email = uniqueEmail();
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

  const createAccount = async (
    session: TestSession,
    body: Record<string, unknown> = {},
  ): Promise<string> => {
    const response = await request(http)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        name: `Conta ${Math.random().toString(36).slice(2, 8)}`,
        type: 'checking',
        initialBalance: 0,
        initialBalanceAt: '2020-01-01',
        ...body,
      })
      .expect(201);

    return response.body.id;
  };

  const categoriesOf = async (session: TestSession) => {
    const { body } = await request(http)
      .get('/api/categories')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    return body as Array<{ id: string; name: string; kind: string }>;
  };

  describe('E3 — categorias', () => {
    it('usuario novo ja nasce com as seis categorias padrao', async () => {
      const session = await register();
      const categories = await categoriesOf(session);

      expect(categories.map((c) => c.name).sort()).toEqual(
        ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Investimento', 'Salário'].sort(),
      );

      expect(categories.find((c) => c.name === 'Investimento')?.kind).toBe('expense');
      expect(categories.find((c) => c.name === 'Alimentação')?.kind).toBe('expense');

      expect(categories.filter((c) => c.kind === 'income').map((c) => c.name)).toEqual(['Salário']);
      expect(categories.filter((c) => c.kind === 'transfer')).toHaveLength(0);
    });

    it('aceita subcategoria de um nivel e recusa o segundo', async () => {
      const session = await register();
      const alimentacao = (await categoriesOf(session)).find((c) => c.name === 'Alimentação')!;

      const { body: filha } = await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'Restaurante', kind: 'expense', parentId: alimentacao.id })
        .expect(201);

      await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'Japones', kind: 'expense', parentId: filha.id })
        .expect(400);
    });

    it('recusa subcategoria com kind diferente do pai', async () => {
      const session = await register();
      const alimentacao = (await categoriesOf(session)).find((c) => c.name === 'Alimentação')!;

      await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'Reembolso', kind: 'income', parentId: alimentacao.id })
        .expect(400);
    });

    it('arquivar categoria com lancamentos exige destino e realoca os existentes', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const categories = await categoriesOf(session);
      const alimentacao = categories.find((c) => c.name === 'Alimentação')!;
      const lazer = categories.find((c) => c.name === 'Lazer')!;

      for (let i = 0; i < 10; i += 1) {
        await request(http)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({
            type: 'debit',
            amount: 25.5,
            description: `Almoco ${i}`,
            occurredAt: '2026-08-03T12:00:00.000Z',
            accountId,
            categoryId: alimentacao.id,
          })
          .expect(201);
      }

      await request(http)
        .post(`/api/categories/${alimentacao.id}/archive`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({})
        .expect(400);

      await request(http)
        .post(`/api/categories/${alimentacao.id}/archive`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ reassignToId: lazer.id })
        .expect(200);

      const { body: page } = await request(http)
        .get(`/api/transactions?categoryId=${lazer.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(page.items).toHaveLength(10);
      expect(page.items.every((t: { categoryId: string }) => t.categoryId === lazer.id)).toBe(true);
    });

    it('recusa realocacao para categoria de outro kind', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const categories = await categoriesOf(session);
      const transporte = categories.find((c) => c.name === 'Transporte')!;
      const salario = categories.find((c) => c.name === 'Salário')!;

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 12,
          description: 'Onibus',
          occurredAt: '2026-08-03T12:00:00.000Z',
          accountId,
          categoryId: transporte.id,
        })
        .expect(201);

      await request(http)
        .post(`/api/categories/${transporte.id}/archive`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ reassignToId: salario.id })
        .expect(400);
    });

    it('exclui subcategoria sem vinculo, e a mae continua de pe', async () => {
      const session = await register();
      const alimentacao = (await categoriesOf(session)).find((c) => c.name === 'Alimentação')!;

      const { body: filha } = await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'Holy Cook', kind: 'expense', parentId: alimentacao.id })
        .expect(201);

      await request(http)
        .delete(`/api/categories/${filha.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);

      const restantes = await categoriesOf(session);
      expect(restantes.map((c) => c.id)).not.toContain(filha.id);
      expect(restantes.map((c) => c.id)).toContain(alimentacao.id);
    });

    it('excluir a mae leva as subcategorias junto', async () => {
      const session = await register();
      const lazer = (await categoriesOf(session)).find((c) => c.name === 'Lazer')!;

      const { body: filha } = await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'Cinema', kind: 'expense', parentId: lazer.id })
        .expect(201);

      const { body: usage } = await request(http)
        .get(`/api/categories/${lazer.id}/usage`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(usage.children.map((c: { id: string }) => c.id)).toEqual([filha.id]);

      await request(http)
        .delete(`/api/categories/${lazer.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);

      const ids = (await categoriesOf(session)).map((c) => c.id);
      expect(ids).not.toContain(lazer.id);
      expect(ids).not.toContain(filha.id);
    });

    it('excluir categoria com lancamento responde 409 e diz quais sao', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const categories = await categoriesOf(session);
      const transporte = categories.find((c) => c.name === 'Transporte')!;
      const lazer = categories.find((c) => c.name === 'Lazer')!;

      const { body: uber } = await request(http)
        .post('/api/categories')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ name: 'App de corrida', kind: 'expense', parentId: transporte.id })
        .expect(201);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 31.9,
          description: 'Corrida para o aeroporto',
          occurredAt: '2026-08-03T12:00:00.000Z',
          accountId,
          categoryId: uber.id,
        })
        .expect(201);

      const { body: usage } = await request(http)
        .get(`/api/categories/${transporte.id}/usage`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(usage.transactionCount).toBe(1);
      expect(usage.transactions[0].description).toBe('Corrida para o aeroporto');
      expect(usage.transactions[0].categoryName).toBe('App de corrida');

      await request(http)
        .delete(`/api/categories/${transporte.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({})
        .expect(409);

      await request(http)
        .delete(`/api/categories/${transporte.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ reassignToId: lazer.id })
        .expect(204);

      const { body: page } = await request(http)
        .get(`/api/transactions?categoryId=${lazer.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(page.items).toHaveLength(1);
      expect((await categoriesOf(session)).map((c) => c.id)).not.toContain(uber.id);
    });

    it('reassignToId null devolve os lancamentos para a fila de revisao', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const moradia = (await categoriesOf(session)).find((c) => c.name === 'Moradia')!;

      const { body: lancamento } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 1200,
          description: 'Aluguel',
          occurredAt: '2026-08-05T12:00:00.000Z',
          accountId,
          categoryId: moradia.id,
        })
        .expect(201);

      await request(http)
        .delete(`/api/categories/${moradia.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ reassignToId: null })
        .expect(204);

      const { body: page } = await request(http)
        .get('/api/transactions?uncategorized=true')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(page.items.map((t: { id: string }) => t.id)).toContain(lancamento.id);
      expect(page.items[0].classificationSource).toBeNull();
    });

    it('recusa realocar a exclusao para categoria de outro kind', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const categories = await categoriesOf(session);
      const alimentacao = categories.find((c) => c.name === 'Alimentação')!;
      const salario = categories.find((c) => c.name === 'Salário')!;

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 40,
          description: 'Mercado',
          occurredAt: '2026-08-03T12:00:00.000Z',
          accountId,
          categoryId: alimentacao.id,
        })
        .expect(201);

      await request(http)
        .delete(`/api/categories/${alimentacao.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ reassignToId: salario.id })
        .expect(400);

      expect((await categoriesOf(session)).map((c) => c.id)).toContain(alimentacao.id);
    });

    it('nao exclui categoria de outro usuario', async () => {
      const dono = await register();
      const intruso = await register();
      const lazer = (await categoriesOf(dono)).find((c) => c.name === 'Lazer')!;

      await request(http)
        .delete(`/api/categories/${lazer.id}`)
        .set('Authorization', `Bearer ${intruso.accessToken}`)
        .expect(404);

      await request(http)
        .get(`/api/categories/${lazer.id}/usage`)
        .set('Authorization', `Bearer ${intruso.accessToken}`)
        .expect(404);

      expect((await categoriesOf(dono)).map((c) => c.id)).toContain(lazer.id);
    });

    it('aceita orcamento mensal e recusa valor com tres casas', async () => {
      const session = await register();
      const lazer = (await categoriesOf(session)).find((c) => c.name === 'Lazer')!;

      await request(http)
        .patch(`/api/categories/${lazer.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ monthlyBudget: 800 })
        .expect(200)
        .expect((res) => expect(res.body.monthlyBudget).toBe(800));

      await request(http)
        .patch(`/api/categories/${lazer.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ monthlyBudget: 10.999 })
        .expect(400);
    });
  });

  describe('E2 — contas e saldo', () => {
    it('credito de 100,00 e debito de 30,00 em conta zerada resultam em 70,00', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Entrada',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 30,
          description: 'Saida',
          occurredAt: '2026-08-02T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      const { body } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(body.balance).toBe(70);
    });

    it('soma 1.000 lancamentos de R$ 0,01 e fecha em exatamente R$ 10,00', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await app.get(DataSource).query(
        `INSERT INTO transactions
           (user_id, account_id, type, amount, currency, description, occurred_at, competence)
         SELECT $1, $2, 'credit', 0.01, 'BRL', 'Centavo ' || g,
                '2026-08-01T12:00:00.000Z'::timestamptz, '2026-08-01'::date
           FROM generate_series(1, 1000) AS g`,
        [session.userId, accountId],
      );

      const { body } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(body.balance).toBe(10);
    }, 120_000);

    it('nao conta lancamento futuro no saldo atual', async () => {
      const session = await register();
      const accountId = await createAccount(session, { initialBalance: 100 });
      const futuro = new Date(Date.now() + 30 * 86_400_000).toISOString();

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 40,
          description: 'Agendado',
          occurredAt: futuro,
          accountId,
        })
        .expect(201);

      const { body } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(body.balance).toBe(100);
    });

    it('transferencia move o dinheiro sem mudar o consolidado da carteira', async () => {
      const session = await register();
      const origem = await createAccount(session, { name: 'Corrente', initialBalance: 1000 });
      const destino = await createAccount(session, {
        name: 'Investimento',
        type: 'investment',
        initialBalance: 0,
      });
      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'transfer',
          amount: 500,
          description: 'Reserva para a viagem',
          occurredAt: '2026-08-05T12:00:00.000Z',
          accountId: origem,
          destinationAccountId: destino,
        })
        .expect(201);

      const { body: wallet } = await request(http)
        .get('/api/accounts/wallet')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(wallet.balance).toBe(1000);
      expect(wallet.accounts.find((a: { id: string }) => a.id === origem).balance).toBe(500);
      expect(wallet.accounts.find((a: { id: string }) => a.id === destino).balance).toBe(500);
    });

    it('arquiva conta preservando o historico', async () => {
      const session = await register();
      const accountId = await createAccount(session, { initialBalance: 50 });

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 20,
          description: 'Compra',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      await request(http)
        .post(`/api/accounts/${accountId}/archive`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      const { body: ativas } = await request(http)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect(ativas.find((a: { id: string }) => a.id === accountId)).toBeUndefined();

      const { body: conta } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect(conta.balance).toBe(30);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 5,
          description: 'Depois de arquivar',
          occurredAt: '2026-08-02T12:00:00.000Z',
          accountId,
        })
        .expect(400);
    });

    it('guarda o icone do banco, troca por PATCH e remove com null', async () => {
      const session = await register();
      const auth = { Authorization: `Bearer ${session.accessToken}` };
      const accountId = await createAccount(session, { icon: 'nubank' });

      const { body: criada } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set(auth)
        .expect(200);
      expect(criada.icon).toBe('nubank');

      const { body: trocada } = await request(http)
        .patch(`/api/accounts/${accountId}`)
        .set(auth)
        .send({ icon: 'banco-do-brasil' })
        .expect(200);
      expect(trocada.icon).toBe('banco-do-brasil');
      expect(trocada.name).toBe(criada.name);

      const { body: renomeada } = await request(http)
        .patch(`/api/accounts/${accountId}`)
        .set(auth)
        .send({ name: 'Conta renomeada' })
        .expect(200);
      expect(renomeada.icon).toBe('banco-do-brasil');

      const { body: limpa } = await request(http)
        .patch(`/api/accounts/${accountId}`)
        .set(auth)
        .send({ icon: null })
        .expect(200);
      expect(limpa.icon).toBeNull();
    });

    it('recusa icone que nao e um identificador de catalogo', async () => {
      const session = await register();

      await request(http)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          name: 'Conta com icone invalido',
          type: 'credit_card',
          initialBalance: 0,
          initialBalanceAt: '2020-01-01',
          icon: '../../etc/passwd',
        })
        .expect(400);
    });

    it('conta sem icone responde null, nao ausencia de campo', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const { body } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(body).toHaveProperty('icon', null);
    });
  });

  describe('E4 — lancamentos', () => {
    it('rejeita valor zero, negativo e com tres casas decimais', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const base = {
        type: 'debit',
        description: 'Teste',
        occurredAt: '2026-08-01T12:00:00.000Z',
        accountId,
      };

      for (const amount of [0, -10, 10.999]) {
        await request(http)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({ ...base, amount })
          .expect(400);
      }
    });

    it('rejeita campo nao declarado no DTO', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 10,
          description: 'Teste',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
          userId: 'outro-usuario',
        })
        .expect(400);
    });

    it('deriva a competencia do mes do lancamento', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const { body } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 10,
          description: 'Fim do mes',
          occurredAt: '2026-08-31T23:00:00.000Z',
          accountId,
        })
        .expect(201);

      expect(body.competence).toBe('2026-08-01');
    });

    it('aceita Investimento num debito e o valor sai do saldo', async () => {
      const session = await register();
      const accountId = await createAccount(session, { initialBalance: 1000 });
      const investimento = (await categoriesOf(session)).find((c) => c.name === 'Investimento')!;

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 500,
          description: 'Aporte no CDB',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
          categoryId: investimento.id,
        })
        .expect(201);

      const { body } = await request(http)
        .get('/api/accounts/wallet')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(body.balance).toBe(500);
    });

    it('recusa categoria de entrada num debito', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const salario = (await categoriesOf(session)).find((c) => c.name === 'Salário')!;

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 500,
          description: 'Classificacao errada',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
          categoryId: salario.id,
        })
        .expect(400);
    });

    it('exige conta de destino na transferencia', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'transfer',
          amount: 100,
          description: 'Sem destino',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(400);
    });

    it('registra trilha de auditoria na criacao e na edicao', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const { body: criado } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 45.9,
          description: 'Mercado',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      await request(http)
        .patch(`/api/transactions/${criado.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ amount: 51.2 })
        .expect(200);

      const { body: trilha } = await request(http)
        .get(`/api/transactions/${criado.id}/audit`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(trilha).toHaveLength(2);
      const edicao = trilha.find((t: { action: string }) => t.action === 'updated');
      expect(edicao.changes.amount).toEqual({ de: 45.9, para: 51.2 });
    });

    it('duplica um lancamento', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      const { body: original } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 33.33,
          description: 'Assinatura',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      const { body: copia } = await request(http)
        .post(`/api/transactions/${original.id}/duplicate`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ occurredAt: '2026-09-01T12:00:00.000Z' })
        .expect(201);

      expect(copia.id).not.toBe(original.id);
      expect(copia.amount).toBe(33.33);
      expect(copia.competence).toBe('2026-09-01');
    });

    it('pagina por cursor sem repetir nem perder item', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      for (let i = 0; i < 7; i += 1) {
        await request(http)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({
            type: 'debit',
            amount: 1 + i,
            description: `Item ${i}`,
            occurredAt: '2026-08-10T12:00:00.000Z',
            accountId,
          })
          .expect(201);
      }

      const vistos = new Set<string>();
      let cursor: string | null = null;
      let paginas = 0;

      do {
        const url: string = cursor
          ? `/api/transactions?limit=3&cursor=${encodeURIComponent(cursor)}`
          : '/api/transactions?limit=3';
        const { body } = await request(http)
          .get(url)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .expect(200);

        for (const item of body.items) vistos.add(item.id);
        cursor = body.nextCursor;
        paginas += 1;
      } while (cursor && paginas < 10);

      expect(vistos.size).toBe(7);
    });

    it('ordem ascendente lista do mais proximo, e o cursor anda para a frente', async () => {
      const session = await register();
      const accountId = await createAccount(session);

      for (const [dia, descricao] of [
        ['20', 'Terceiro'],
        ['05', 'Primeiro'],
        ['12', 'Segundo'],
      ] as const) {
        await request(http)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({
            type: 'debit',
            amount: 10,
            description: descricao,
            occurredAt: `2026-12-${dia}T12:00:00.000Z`,
            accountId,
          })
          .expect(201);
      }

      const primeira = await request(http)
        .get('/api/transactions?order=asc&limit=2')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(primeira.body.items.map((t: { description: string }) => t.description)).toEqual([
        'Primeiro',
        'Segundo',
      ]);

      const segunda = await request(http)
        .get(
          `/api/transactions?order=asc&limit=2&cursor=${encodeURIComponent(primeira.body.nextCursor)}`,
        )
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(segunda.body.items.map((t: { description: string }) => t.description)).toEqual([
        'Terceiro',
      ]);
      expect(segunda.body.nextCursor).toBeNull();
    });

    it('filtra por texto, tipo, faixa de valor e categoria excluida', async () => {
      const session = await register();
      const accountId = await createAccount(session);
      const lazer = (await categoriesOf(session)).find((c) => c.name === 'Lazer')!;

      const enviar = (body: Record<string, unknown>) =>
        request(http)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({ occurredAt: '2026-08-15T12:00:00.000Z', accountId, ...body })
          .expect(201);

      await enviar({
        type: 'debit',
        amount: 200,
        description: 'Cinema Belas Artes',
        categoryId: lazer.id,
      });
      await enviar({ type: 'debit', amount: 15, description: 'Padaria do Ze' });
      await enviar({ type: 'credit', amount: 5000, description: 'Salario' });

      const get = async (qs: string) => {
        const { body } = await request(http)
          .get(`/api/transactions?${qs}`)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .expect(200);
        return body.items as Array<{ description: string }>;
      };

      expect(await get('search=padaria')).toHaveLength(1);
      expect(await get('type=credit')).toHaveLength(1);
      expect(await get('minAmount=100')).toHaveLength(2);

      const semLazer = await get(`excludeCategoryId=${lazer.id}`);
      expect(semLazer).toHaveLength(2);
      expect(semLazer.some((t) => t.description === 'Cinema Belas Artes')).toBe(false);
    });

    it('isola os dados entre usuarios: o de outro nao existe, nem com 403', async () => {
      const alice = await register();
      const bob = await register();
      const contaDaAlice = await createAccount(alice);

      const { body: lancamentoDaAlice } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({
          type: 'debit',
          amount: 99,
          description: 'Privado',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId: contaDaAlice,
        })
        .expect(201);

      await request(http)
        .get(`/api/transactions/${lancamentoDaAlice.id}`)
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(404);

      await request(http)
        .get(`/api/accounts/${contaDaAlice}`)
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(404);

      await request(http)
        .delete(`/api/transactions/${lancamentoDaAlice.id}`)
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(404);

      const { body: page } = await request(http)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(200);
      expect(page.items).toHaveLength(0);
    });

    it('excluir lancamento devolve o saldo ao valor anterior', async () => {
      const session = await register();
      const accountId = await createAccount(session, { initialBalance: 500 });

      const { body: lancamento } = await request(http)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          type: 'debit',
          amount: 123.45,
          description: 'A remover',
          occurredAt: '2026-08-01T12:00:00.000Z',
          accountId,
        })
        .expect(201);

      await request(http)
        .delete(`/api/transactions/${lancamento.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);

      const { body: conta } = await request(http)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(conta.balance).toBe(500);
    });
  });
});

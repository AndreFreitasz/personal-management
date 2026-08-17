import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, resetDatabase, TestSession, uniqueEmail } from './helpers';

describe('E1 — conta e autenticacao', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  const register = async (email = uniqueEmail()): Promise<TestSession> => {
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

  it('registra, acessa rota protegida, desloga e perde o acesso na hora', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(session.email);
        expect(res.body).not.toHaveProperty('passwordHash');
        expect(res.body).not.toHaveProperty('password_hash');
      });

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(401);
  });

  it('recusa requisicao sem token e com token adulterado', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer nao.e.um.token')
      .expect(401);
  });

  it('faz login e devolve par novo no refresh, invalidando o antigo', async () => {
    const { email } = await register();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'senha-forte-123' })
      .expect(200);

    const first = login.body.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);

    expect(refreshed.body.refreshToken).not.toBe(first);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
  });

  it('revoga a familia inteira quando um refresh e reapresentado (replay)', async () => {
    const session = await register();

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(401);
  });

  it('nao revela quais e-mails estao cadastrados', async () => {
    const { email } = await register();

    const senhaErrada = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'senha-errada-123' })
      .expect(401);

    const emailInexistente = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nao-existe'), password: 'senha-errada-123' })
      .expect(401);

    expect(senhaErrada.body.message).toBe(emailInexistente.body.message);
  });

  it('recusa e-mail duplicado com 409', async () => {
    const { email } = await register();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'outra-senha-123', name: 'Outro' })
      .expect(409);
  });

  it('normaliza o e-mail para minusculas no cadastro e no login', async () => {
    const email = uniqueEmail('CaIxA');

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'senha-forte-123', name: 'Caixa Alta' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: email.toLowerCase(), password: 'senha-forte-123' })
      .expect(200);
  });

  it('rejeita campo nao declarado no DTO', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: uniqueEmail(),
        password: 'senha-forte-123',
        name: 'Fulano',
        isAdmin: true,
      })
      .expect(400);
  });

  it('responde 202 no esqueci-a-senha mesmo para e-mail inexistente', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('fantasma') })
      .expect(202);
  });

  it('atualiza o perfil do proprio usuario', async () => {
    const session = await register();

    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ name: 'Nome Novo', timezone: 'America/Manaus' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Nome Novo');
        expect(res.body.timezone).toBe('America/Manaus');
      });
  });
});

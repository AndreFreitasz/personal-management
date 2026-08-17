import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);

  const [{ current_database: database }] = await dataSource.query<
    Array<{ current_database: string }>
  >('SELECT current_database()');

  if (!database.endsWith('_test')) {
    throw new Error(
      `resetDatabase abortado: "${database}" nao termina em "_test".\n` +
        'A suite e2e apaga TODAS as tabelas em cascata. Rodar isto contra o banco ' +
        'de desenvolvimento destroi os dados reais. Ver test/setup-env.ts.',
    );
  }

  await dataSource.query('TRUNCATE TABLE "transaction_audits" CASCADE');
  await dataSource.query('TRUNCATE TABLE "users" CASCADE');
}

export interface TestSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

let sequence = 0;

export function uniqueEmail(prefix = 'teste'): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}@exemplo.test`;
}

export const auth = (session: TestSession): [string, string] => [
  'Authorization',
  `Bearer ${session.accessToken}`,
];

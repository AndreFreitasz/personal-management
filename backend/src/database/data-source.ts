import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export interface DatabaseEnv {
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_LOGGING: boolean;
}

export function buildDataSourceOptions(
  env: DatabaseEnv,
  target: 'src' | 'dist',
): DataSourceOptions {
  const ext = target === 'src' ? 'ts' : 'js';

  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    entities: [`${target}/**/*.entity.${ext}`],
    migrations: [`${target}/database/migrations/*.${ext}`],
    synchronize: false,
    migrationsRun: false,
    logging: env.DB_LOGGING,
  };
}

export default new DataSource(
  buildDataSourceOptions(
    {
      DB_HOST: process.env.DB_HOST ?? 'localhost',
      DB_PORT: Number(process.env.DB_PORT ?? 5432),
      DB_USERNAME: process.env.DB_USERNAME ?? 'finances',
      DB_PASSWORD: process.env.DB_PASSWORD ?? 'finances',
      DB_DATABASE: process.env.DB_DATABASE ?? 'finances',
      DB_LOGGING: process.env.DB_LOGGING === 'true',
    },
    'src',
  ),
);

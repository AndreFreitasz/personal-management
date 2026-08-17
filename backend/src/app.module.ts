import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { buildDataSourceOptions } from './database/data-source';
import { HealthModule } from './health/health.module';
import { RecurrencesModule } from './recurrences/recurrences.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(
          {
            DB_HOST: config.get('DB_HOST', { infer: true }),
            DB_PORT: config.get('DB_PORT', { infer: true }),
            DB_USERNAME: config.get('DB_USERNAME', { infer: true }),
            DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
            DB_DATABASE: config.get('DB_DATABASE', { infer: true }),
            DB_LOGGING: config.get('DB_LOGGING', { infer: true }),
          },
          'dist',
        ),
        entities: [],
        autoLoadEntities: true,
      }),
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    AccountsModule,
    TransactionsModule,
    RecurrencesModule,
    DashboardModule,
  ],
})
export class AppModule {}

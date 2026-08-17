import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '../accounts/accounts.module';
import { Category } from '../categories/entities/category.entity';
import { GeneratedTransaction } from './entities/generated-transaction.entity';
import { RecurrenceAmount } from './entities/recurrence-amount.entity';
import { Recurrence } from './entities/recurrence.entity';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesScheduler } from './recurrences.scheduler';
import { RecurrencesService } from './recurrences.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recurrence, RecurrenceAmount, GeneratedTransaction, Category]),
    AccountsModule,
  ],
  controllers: [RecurrencesController],
  providers: [RecurrencesService, RecurrencesScheduler],
  exports: [RecurrencesService],
})
export class RecurrencesModule {}

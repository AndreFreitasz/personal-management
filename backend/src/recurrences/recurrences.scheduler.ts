import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RecurrencesService } from './recurrences.service';

@Injectable()
export class RecurrencesScheduler {
  private readonly logger = new Logger(RecurrencesScheduler.name);

  constructor(private readonly recurrences: RecurrencesService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'materializar-recorrencias' })
  async run(): Promise<void> {
    try {
      const report = await this.recurrences.materializeDue();
      if (report.created > 0) {
        this.logger.log(`Materializadas ${report.created} competencias.`);
      }
    } catch (cause) {
      this.logger.error('Falha ao materializar recorrencias.', cause);
    }
  }
}

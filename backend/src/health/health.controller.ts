import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Public } from '../auth/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

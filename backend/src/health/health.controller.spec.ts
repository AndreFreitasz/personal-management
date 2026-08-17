import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  async function build(query: jest.Mock): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getDataSourceToken(), useValue: { query } as Partial<DataSource> }],
    }).compile();

    return moduleRef.get(HealthController);
  }

  it('reporta ok quando o banco responde', async () => {
    const controller = await build(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('reporta degraded em vez de estourar quando o banco esta fora', async () => {
    const controller = await build(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(controller.check()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });
});

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { AccountsService } from '../accounts/accounts.service';
import { Category } from '../categories/entities/category.entity';
import { competenceOf, parseCompetence, shiftCompetence } from '../common/date/competence';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { assertCategoryMatchesType, assertTransferShape } from '../transactions/transaction-rules';
import {
  AdjustAmountDto,
  CreateRecurrenceDto,
  OccurrenceDto,
  UpdateRecurrenceDto,
} from './dto/recurrence.dto';
import { GeneratedTransaction } from './entities/generated-transaction.entity';
import { RecurrenceAmount } from './entities/recurrence-amount.entity';
import { Recurrence } from './entities/recurrence.entity';
import {
  Adjustment,
  amountFor,
  dueCompetences,
  installmentNumber,
  occurrenceFor,
  ScheduleType,
} from './recurrence-schedule';

const DEFAULT_ADJUSTMENT: Record<TransactionType, Adjustment> = {
  [TransactionType.Credit]: Adjustment.PreviousBusinessDay,
  [TransactionType.Debit]: Adjustment.NextBusinessDay,
  [TransactionType.Transfer]: Adjustment.NextBusinessDay,
};

const PREVIEW_MONTHS = 12;

const MATERIALIZATION_LOCK = 776_501;

export interface MaterializationReport {
  created: number;
  skipped: boolean;
}

@Injectable()
export class RecurrencesService {
  private readonly logger = new Logger(RecurrencesService.name);

  constructor(
    @InjectRepository(Recurrence)
    private readonly recurrences: Repository<Recurrence>,
    @InjectRepository(RecurrenceAmount)
    private readonly amounts: Repository<RecurrenceAmount>,
    @InjectRepository(GeneratedTransaction)
    private readonly generated: Repository<GeneratedTransaction>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly accounts: AccountsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateRecurrenceDto): Promise<Recurrence> {
    if (dto.type === TransactionType.Transfer) {
      throw new BadRequestException(
        'Transferencia entre contas nao pode ser recorrente. Para aporte mensal, use Saida com a categoria Investimento.',
      );
    }

    const destinationAccountId = dto.destinationAccountId ?? null;
    assertTransferShape(dto.type, dto.accountId, destinationAccountId);

    const account = await this.accounts.assertUsable(userId, dto.accountId);
    if (destinationAccountId) {
      const destination = await this.accounts.assertUsable(userId, destinationAccountId);
      if (destination.currency !== account.currency) {
        throw new BadRequestException('Transferencia entre moedas diferentes nao e suportada.');
      }
    }

    await this.assertCategoryUsable(userId, dto.categoryId ?? null, dto.type);
    assertScheduleShape(dto.scheduleType, dto.dayOfMonth ?? null);

    const startsOn = parseCompetence(dto.startsOn);
    const endsOn = dto.endsOn ? parseCompetence(dto.endsOn) : null;

    if (endsOn && dto.installments) {
      throw new BadRequestException(
        'Informe endsOn ou installments, nunca os dois: o fim precisa de uma fonte so.',
      );
    }
    if (endsOn && endsOn < startsOn) {
      throw new BadRequestException('endsOn nao pode ser anterior a startsOn.');
    }

    return this.dataSource.transaction(async (manager) => {
      const recurrence = await manager.save(
        Recurrence,
        manager.create(Recurrence, {
          userId,
          accountId: dto.accountId,
          destinationAccountId,
          categoryId: dto.categoryId ?? null,
          type: dto.type,
          description: dto.description,
          currency: account.currency,
          scheduleType: dto.scheduleType,
          dayOfMonth:
            dto.scheduleType === ScheduleType.DayOfMonth ? (dto.dayOfMonth ?? null) : null,
          adjustment: dto.adjustment ?? DEFAULT_ADJUSTMENT[dto.type],
          startsOn,
          endsOn,
          installments: dto.installments ?? null,
        }),
      );

      await manager.save(
        RecurrenceAmount,
        manager.create(RecurrenceAmount, {
          recurrenceId: recurrence.id,
          amount: dto.amount,
          validFrom: startsOn,
        }),
      );

      await this.materializeOne(manager, recurrence, competenceOf(new Date()));

      return recurrence;
    });
  }

  async list(userId: string, includePaused: boolean): Promise<Recurrence[]> {
    return this.recurrences.find({
      where: includePaused ? { userId } : { userId, pausedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async getOwned(userId: string, id: string): Promise<Recurrence> {
    const recurrence = await this.recurrences.findOne({ where: { id, userId } });
    if (!recurrence) {
      throw new NotFoundException('Recorrencia nao encontrada.');
    }
    return recurrence;
  }

  async update(userId: string, id: string, dto: UpdateRecurrenceDto): Promise<Recurrence> {
    const recurrence = await this.getOwned(userId, id);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryUsable(userId, dto.categoryId, recurrence.type);
      recurrence.categoryId = dto.categoryId;
    }

    if (dto.scheduleType !== undefined || dto.dayOfMonth !== undefined) {
      const scheduleType = dto.scheduleType ?? recurrence.scheduleType;
      const dayOfMonth = dto.dayOfMonth !== undefined ? dto.dayOfMonth : recurrence.dayOfMonth;
      assertScheduleShape(scheduleType, dayOfMonth);

      recurrence.scheduleType = scheduleType;
      recurrence.dayOfMonth = scheduleType === ScheduleType.DayOfMonth ? dayOfMonth : null;
    }

    if (dto.description !== undefined) recurrence.description = dto.description;
    if (dto.adjustment !== undefined) recurrence.adjustment = dto.adjustment;

    if (dto.endsOn !== undefined) {
      const endsOn = dto.endsOn === null ? null : parseCompetence(dto.endsOn);

      if (endsOn !== null && recurrence.installments !== null) {
        throw new BadRequestException('Recorrencia parcelada ja tem fim definido pelas parcelas.');
      }
      if (endsOn !== null && endsOn < recurrence.startsOn) {
        throw new BadRequestException('endsOn nao pode ser anterior a startsOn.');
      }
      recurrence.endsOn = endsOn;
    }

    return this.recurrences.save(recurrence);
  }

  async setPaused(userId: string, id: string, paused: boolean): Promise<Recurrence> {
    const recurrence = await this.getOwned(userId, id);
    recurrence.pausedAt = paused ? new Date() : null;

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(Recurrence, recurrence);
      if (!paused) {
        await this.materializeOne(manager, saved, competenceOf(new Date()));
      }
      return saved;
    });
  }

  async adjustAmount(userId: string, id: string, dto: AdjustAmountDto): Promise<Recurrence> {
    const recurrence = await this.getOwned(userId, id);
    const validFrom = parseCompetence(dto.validFrom);

    if (validFrom < recurrence.startsOn) {
      throw new BadRequestException('O reajuste nao pode valer antes do inicio da recorrencia.');
    }

    const existing = await this.amounts.findOne({ where: { recurrenceId: id, validFrom } });

    if (existing) {
      existing.amount = dto.amount;
      await this.amounts.save(existing);
    } else {
      await this.amounts.save(
        this.amounts.create({ recurrenceId: id, amount: dto.amount, validFrom }),
      );
    }

    return recurrence;
  }

  async currentAmounts(
    recurrenceIds: string[],
    on: Date = new Date(),
  ): Promise<Map<string, number>> {
    if (recurrenceIds.length === 0) return new Map();

    const periods = await this.amounts.find({ where: { recurrenceId: In(recurrenceIds) } });
    const competence = competenceOf(on);

    const byRecurrence = new Map<string, RecurrenceAmount[]>();
    for (const period of periods) {
      const bucket = byRecurrence.get(period.recurrenceId) ?? [];
      bucket.push(period);
      byRecurrence.set(period.recurrenceId, bucket);
    }

    const current = new Map<string, number>();
    for (const [id, bucket] of byRecurrence) {
      const earliest = bucket.reduce((a, b) => (a.validFrom <= b.validFrom ? a : b));
      const applicable = bucket.some((p) => p.validFrom <= competence)
        ? amountFor(bucket, competence)
        : earliest.amount;
      current.set(id, applicable);
    }

    return current;
  }

  async materializedCounts(recurrenceIds: string[]): Promise<Map<string, number>> {
    if (recurrenceIds.length === 0) return new Map();

    const rows = await this.generated.find({
      where: { recurrenceId: In(recurrenceIds) },
      select: { recurrenceId: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.recurrenceId, (counts.get(row.recurrenceId) ?? 0) + 1);
    }
    return counts;
  }

  async preview(userId: string, id: string, from: Date = new Date()): Promise<OccurrenceDto[]> {
    const recurrence = await this.getOwned(userId, id);
    const periods = await this.amounts.find({ where: { recurrenceId: id } });

    const done = new Set(
      (
        await this.generated.find({
          where: { recurrenceId: id },
          select: { competence: true },
        })
      ).map((row) => row.competence),
    );

    const start = maxOf(recurrence.startsOn, competenceOf(from));
    const horizon = shiftCompetence(start, PREVIEW_MONTHS - 1);

    const competences = dueCompetences(
      {
        startsOn: recurrence.startsOn,
        endsOn: recurrence.endsOn,
        installments: recurrence.installments,
        createdCompetence: recurrence.startsOn,
        paused: false,
      },
      horizon,
      { includeBeforeCreation: true },
    ).filter((competence) => competence >= start);

    return competences.map((competence) => ({
      competence,
      occursOn: occurrenceFor(competence, {
        type: recurrence.scheduleType,
        dayOfMonth: recurrence.dayOfMonth,
        adjustment: recurrence.adjustment,
      }),
      amount: amountFor(periods, competence),
      installment:
        recurrence.installments === null
          ? null
          : installmentNumber(recurrence.startsOn, competence),
      materialized: done.has(competence),
    }));
  }

  async backfill(userId: string, id: string, now: Date = new Date()): Promise<number> {
    const recurrence = await this.getOwned(userId, id);

    return this.dataSource.transaction(async (manager) =>
      this.materializeOne(manager, recurrence, competenceOf(now), {
        includeBeforeCreation: true,
      }),
    );
  }

  private async assertCategoryUsable(
    userId: string,
    categoryId: string | null,
    type: TransactionType,
  ): Promise<void> {
    if (categoryId === null) {
      assertCategoryMatchesType(type, null);
      return;
    }

    const category = await this.categories.findOne({ where: { id: categoryId, userId } });
    if (!category) {
      throw new NotFoundException('Categoria nao encontrada.');
    }
    if (category.archivedAt !== null) {
      throw new BadRequestException('Categoria arquivada nao aceita lancamento novo.');
    }

    assertCategoryMatchesType(type, category.kind);
  }

  async materializeDue(now: Date = new Date()): Promise<MaterializationReport> {
    return this.dataSource.transaction(async (manager) => {
      const [lock] = await manager.query<Array<{ locked: boolean }>>(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [MATERIALIZATION_LOCK],
      );

      if (!lock.locked) {
        this.logger.log('Materializacao ja em andamento em outra replica; nada a fazer.');
        return { created: 0, skipped: true };
      }

      const active = await manager.find(Recurrence, { where: { pausedAt: IsNull() } });

      let created = 0;
      for (const recurrence of active) {
        created += await this.materializeOne(manager, recurrence, competenceOf(now));
      }

      if (created > 0) {
        this.logger.log(`Materializadas ${created} competencias.`);
      }
      return { created, skipped: false };
    });
  }

  private async materializeOne(
    manager: EntityManager,
    recurrence: Recurrence,
    upTo: string,
    options: { includeBeforeCreation?: boolean } = {},
  ): Promise<number> {
    const due = dueCompetences(
      {
        startsOn: recurrence.startsOn,
        endsOn: recurrence.endsOn,
        installments: recurrence.installments,
        createdCompetence: competenceOf(recurrence.createdAt),
        paused: recurrence.pausedAt !== null,
      },
      upTo,
      options,
    );

    if (due.length === 0) return 0;

    const already = await manager.find(GeneratedTransaction, {
      where: { recurrenceId: recurrence.id },
      select: { competence: true },
    });
    const done = new Set(already.map((row) => row.competence));

    const missing = due.filter((competence) => !done.has(competence));
    if (missing.length === 0) return 0;

    const periods = await manager.find(RecurrenceAmount, {
      where: { recurrenceId: recurrence.id },
    });

    for (const competence of missing) {
      await this.materializeCompetence(manager, recurrence, competence, periods);
    }

    return missing.length;
  }

  private async materializeCompetence(
    manager: EntityManager,
    recurrence: Recurrence,
    competence: string,
    periods: RecurrenceAmount[],
  ): Promise<void> {
    const occurredOn = occurrenceFor(competence, {
      type: recurrence.scheduleType,
      dayOfMonth: recurrence.dayOfMonth,
      adjustment: recurrence.adjustment,
    });

    const transaction = manager.create(Transaction, {
      userId: recurrence.userId,
      accountId: recurrence.accountId,
      destinationAccountId: recurrence.destinationAccountId,
      categoryId: recurrence.categoryId,
      type: recurrence.type,
      amount: amountFor(periods, competence),
      currency: recurrence.currency,
      description: describe(recurrence, competence),
      occurredAt: new Date(`${occurredOn}T00:00:00.000Z`),
      competence,
      status: statusFor(recurrence.type),
    });

    const saved = await manager.save(Transaction, transaction);

    await manager.save(
      GeneratedTransaction,
      manager.create(GeneratedTransaction, {
        recurrenceId: recurrence.id,
        transactionId: saved.id,
        competence,
      }),
    );
  }
}

function statusFor(type: TransactionType): TransactionStatus {
  return type === TransactionType.Debit ? TransactionStatus.Pending : TransactionStatus.Paid;
}

function assertScheduleShape(scheduleType: ScheduleType, dayOfMonth: number | null): void {
  if (scheduleType === ScheduleType.DayOfMonth) {
    if (dayOfMonth === null) {
      throw new BadRequestException('Agendamento por dia fixo exige dayOfMonth.');
    }
    return;
  }

  if (dayOfMonth !== null) {
    throw new BadRequestException('dayOfMonth so faz sentido em agendamento por dia fixo.');
  }
}

function maxOf(a: string, b: string): string {
  return a > b ? a : b;
}

function describe(recurrence: Recurrence, competence: string): string {
  if (recurrence.installments === null) return recurrence.description;

  const current = installmentNumber(recurrence.startsOn, competence);
  return `${recurrence.description} (${current}/${recurrence.installments})`;
}

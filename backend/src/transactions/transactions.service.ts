import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { AccountsService } from '../accounts/accounts.service';
import { Category } from '../categories/entities/category.entity';
import { competenceOf } from '../common/date/competence';
import { decodeCursor, Page, toPage } from '../common/pagination/cursor';
import {
  CreateTransactionDto,
  DuplicateTransactionDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { AuditAction, TransactionAudit } from './entities/transaction-audit.entity';
import { applyTransactionFilters } from './transaction-filter';
import { ClassificationSource, Transaction, TransactionType } from './entities/transaction.entity';
import { assertCategoryMatchesType, assertTransferShape } from './transaction-rules';

const DEFAULT_LIMIT = 50;

const AUDITED_FIELDS = [
  'type',
  'amount',
  'currency',
  'description',
  'occurredAt',
  'competence',
  'accountId',
  'destinationAccountId',
  'categoryId',
  'status',
] as const;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly accounts: AccountsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const destinationAccountId = dto.destinationAccountId ?? null;
    assertTransferShape(dto.type, dto.accountId, destinationAccountId);

    const account = await this.accounts.assertUsable(userId, dto.accountId);

    if (destinationAccountId) {
      const destination = await this.accounts.assertUsable(userId, destinationAccountId);
      if (destination.currency !== account.currency) {
        throw new BadRequestException('Transferencia entre moedas diferentes nao e suportada.');
      }
    }

    const category = await this.resolveCategory(userId, dto.categoryId ?? null, dto.type);
    const occurredAt = new Date(dto.occurredAt);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Transaction);
      const saved = await repo.save(
        repo.create({
          userId,
          accountId: account.id,
          destinationAccountId,
          categoryId: category?.id ?? null,
          type: dto.type,
          amount: dto.amount,
          currency: dto.currency ?? account.currency,
          description: dto.description,
          occurredAt,
          competence: competenceOf(occurredAt),
          classificationSource: category ? ClassificationSource.Manual : null,
          classifiedAt: category ? new Date() : null,
        }),
      );

      await this.audit(manager, saved, AuditAction.Created, snapshot(saved));
      return saved;
    });
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactions.findOne({ where: { id, userId } });
    if (!transaction) {
      throw new NotFoundException('Lancamento nao encontrado.');
    }
    return transaction;
  }

  async list(userId: string, query: ListTransactionsQueryDto): Promise<Page<Transaction>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const ascending = query.order === 'asc';

    const qb = this.transactions
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.occurred_at', ascending ? 'ASC' : 'DESC')
      .addOrderBy('t.id', ascending ? 'ASC' : 'DESC')
      .take(limit + 1);

    applyTransactionFilters(qb, query);

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        ascending
          ? '(t.occurred_at, t.id) > (:cursorOccurredAt, :cursorId)'
          : '(t.occurred_at, t.id) < (:cursorOccurredAt, :cursorId)',
        { cursorOccurredAt: cursor.occurredAt, cursorId: cursor.id },
      );
    }

    return toPage(await qb.getMany(), limit);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const current = await this.findOne(userId, id);
    const before = snapshot(current);

    const type = dto.type ?? current.type;
    const accountId = dto.accountId ?? current.accountId;
    let destinationAccountId = dto.destinationAccountId ?? null;
    if (dto.destinationAccountId === undefined) {
      destinationAccountId = type === current.type ? current.destinationAccountId : null;
    }

    assertTransferShape(type, accountId, destinationAccountId);

    const account = await this.accounts.assertUsable(userId, accountId);
    if (destinationAccountId) {
      const destination = await this.accounts.assertUsable(userId, destinationAccountId);
      if (destination.currency !== account.currency) {
        throw new BadRequestException('Transferencia entre moedas diferentes nao e suportada.');
      }
    }

    const categoryId = dto.categoryId === undefined ? current.categoryId : dto.categoryId;
    const category = await this.resolveCategory(userId, categoryId, type);

    current.type = type;
    current.accountId = account.id;
    current.destinationAccountId = destinationAccountId;
    current.categoryId = category?.id ?? null;

    if (dto.amount !== undefined) current.amount = dto.amount;
    if (dto.description !== undefined) current.description = dto.description;
    if (dto.status !== undefined) current.status = dto.status;
    if (dto.occurredAt !== undefined) {
      current.occurredAt = new Date(dto.occurredAt);
      current.competence = competenceOf(current.occurredAt);
    }

    if (category && category.id !== before.categoryId) {
      current.classificationSource = ClassificationSource.Manual;
      current.classifiedAt = new Date();
    }
    if (!category) {
      current.classificationSource = null;
      current.classifiedAt = null;
    }

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Transaction).save(current);
      const changes = diff(before, snapshot(saved));

      if (Object.keys(changes).length > 0) {
        await this.audit(manager, saved, AuditAction.Updated, changes);
      }
      return saved;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.findOne(userId, id);

    await this.dataSource.transaction(async (manager) => {
      await this.audit(manager, transaction, AuditAction.Deleted, snapshot(transaction));
      await manager.getRepository(Transaction).delete({ id: transaction.id, userId });
    });
  }

  async categorize(userId: string, id: string, categoryId: string | null): Promise<Transaction> {
    return this.update(userId, id, { categoryId });
  }

  async duplicate(userId: string, id: string, dto: DuplicateTransactionDto): Promise<Transaction> {
    const original = await this.findOne(userId, id);

    return this.create(userId, {
      type: original.type,
      amount: original.amount,
      description: original.description,
      occurredAt: dto.occurredAt ?? original.occurredAt.toISOString(),
      accountId: original.accountId,
      destinationAccountId: original.destinationAccountId ?? undefined,
      categoryId: original.categoryId ?? undefined,
      currency: original.currency,
    });
  }

  auditTrail(userId: string, transactionId: string): Promise<TransactionAudit[]> {
    return this.dataSource.getRepository(TransactionAudit).find({
      where: { userId, transactionId },
      order: { createdAt: 'DESC' },
    });
  }

  private async resolveCategory(
    userId: string,
    categoryId: string | null,
    type: TransactionType,
  ): Promise<Category | null> {
    if (!categoryId) {
      return null;
    }

    const category = await this.categories.findOne({
      where: { id: categoryId, userId, archivedAt: IsNull() },
    });

    if (!category) {
      throw new BadRequestException('Categoria nao encontrada ou arquivada.');
    }

    assertCategoryMatchesType(type, category.kind);
    return category;
  }

  private async audit(
    manager: EntityManager,
    transaction: Transaction,
    action: AuditAction,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const repo = manager.getRepository(TransactionAudit);
    await repo.save(
      repo.create({
        transactionId: transaction.id,
        userId: transaction.userId,
        action,
        changes,
      }),
    );
  }
}

type Snapshot = Record<(typeof AUDITED_FIELDS)[number], unknown>;

function snapshot(transaction: Transaction): Snapshot {
  const source = transaction as unknown as Record<string, unknown>;
  const result = {} as Snapshot;

  for (const field of AUDITED_FIELDS) {
    const value = source[field];
    result[field] = value instanceof Date ? value.toISOString() : value;
  }

  return result;
}

function diff(before: Snapshot, after: Snapshot): Record<string, { de: unknown; para: unknown }> {
  const changes: Record<string, { de: unknown; para: unknown }> = {};

  for (const field of AUDITED_FIELDS) {
    if (before[field] !== after[field]) {
      changes[field] = { de: before[field], para: after[field] };
    }
  }

  return changes;
}

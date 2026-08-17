import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { Account } from './entities/account.entity';

interface BalanceRow {
  account_id: string;
  archived_at: Date | null;
  balance: string;
}

const BALANCE_SQL = `
  WITH movements AS (
    SELECT t.account_id AS account_id,
           t.occurred_at AS occurred_at,
           CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END AS delta
      FROM transactions t
     WHERE t.user_id = $1
       AND t.status = 'paid'
    UNION ALL
    SELECT t.destination_account_id AS account_id,
           t.occurred_at AS occurred_at,
           t.amount AS delta
      FROM transactions t
     WHERE t.user_id = $1
       AND t.status = 'paid'
       AND t.destination_account_id IS NOT NULL
  )
  SELECT a.id AS account_id,
         a.archived_at AS archived_at,
         (a.initial_balance + COALESCE(SUM(m.delta), 0))::text AS balance
    FROM accounts a
    LEFT JOIN movements m
           ON m.account_id = a.id
          AND m.occurred_at <= now()
          AND m.occurred_at >= a.initial_balance_at
   WHERE a.user_id = $1
   GROUP BY a.id, a.archived_at, a.initial_balance
`;

const WALLET_SQL = `
  SELECT COALESCE(SUM(b.balance::numeric), 0)::text AS total
    FROM (${BALANCE_SQL}) b
   WHERE b.archived_at IS NULL
`;

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
  ) {}

  list(userId: string, includeArchived = false): Promise<Account[]> {
    return this.accounts.find({
      where: includeArchived ? { userId } : { userId, archivedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async getOwned(userId: string, id: string): Promise<Account> {
    const account = await this.accounts.findOne({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException('Conta nao encontrada.');
    }
    return account;
  }

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    await this.assertNameIsFree(userId, dto.name);

    return this.accounts.save(
      this.accounts.create({
        userId,
        name: dto.name,
        type: dto.type,
        initialBalance: dto.initialBalance ?? 0,
        initialBalanceAt: dto.initialBalanceAt ?? today(),
        currency: dto.currency ?? 'BRL',
        icon: dto.icon ?? null,
        archivedAt: null,
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.getOwned(userId, id);

    if (account.archivedAt !== null) {
      throw new ConflictException('Conta arquivada nao pode ser editada.');
    }
    if (dto.name !== undefined && dto.name !== account.name) {
      await this.assertNameIsFree(userId, dto.name, id);
      account.name = dto.name;
    }
    if (dto.type !== undefined) account.type = dto.type;
    if (dto.initialBalance !== undefined) account.initialBalance = dto.initialBalance;
    if (dto.initialBalanceAt !== undefined) account.initialBalanceAt = dto.initialBalanceAt;
    if (dto.icon !== undefined) account.icon = dto.icon;

    return this.accounts.save(account);
  }

  async archive(userId: string, id: string): Promise<Account> {
    const account = await this.getOwned(userId, id);

    if (account.archivedAt !== null) {
      throw new ConflictException('Conta ja arquivada.');
    }

    account.archivedAt = new Date();
    return this.accounts.save(account);
  }

  async balancesOf(userId: string): Promise<Map<string, number>> {
    const rows = await this.accounts.query<BalanceRow[]>(BALANCE_SQL, [userId]);
    return new Map(rows.map((row) => [row.account_id, Number(row.balance)]));
  }

  async balanceOf(userId: string, accountId: string): Promise<number> {
    await this.getOwned(userId, accountId);
    const balances = await this.balancesOf(userId);
    return balances.get(accountId) ?? 0;
  }

  async wallet(
    userId: string,
  ): Promise<{ balance: number; accounts: Account[]; balances: Map<string, number> }> {
    const [accounts, balances, totalRows] = await Promise.all([
      this.list(userId),
      this.balancesOf(userId),
      this.accounts.query<Array<{ total: string }>>(WALLET_SQL, [userId]),
    ]);

    return {
      balance: Number(totalRows[0]?.total ?? '0'),
      accounts,
      balances,
    };
  }

  private async assertNameIsFree(userId: string, name: string, exceptId?: string): Promise<void> {
    const clash = await this.accounts.findOne({ where: { userId, name, archivedAt: IsNull() } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException('Ja existe uma conta ativa com esse nome.');
    }
  }

  async assertUsable(userId: string, id: string): Promise<Account> {
    const account = await this.getOwned(userId, id);
    if (account.archivedAt !== null) {
      throw new BadRequestException(`A conta "${account.name}" esta arquivada.`);
    }
    return account;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

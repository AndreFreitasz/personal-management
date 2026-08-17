import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AccountsService } from '../accounts/accounts.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { applyTransactionFilters, TransactionFilter } from '../transactions/transaction-filter';
import {
  AccountSliceDto,
  BalancePointDto,
  BalanceSeriesResponseDto,
  ByAccountResponseDto,
  ByCategoryResponseDto,
  CategoryChildDto,
  CategorySliceDto,
  DashboardQueryDto,
  DayQueryDto,
  DayResponseDto,
  DayTransactionDto,
  MonthlyComparisonResponseDto,
  MonthlyPointDto,
  PeriodDto,
  ProjectionResponseDto,
  SummaryResponseDto,
  TopMerchantsResponseDto,
} from './dto/dashboard.dto';
import { competencesIn, Period, PeriodPreset, previousPeriod, resolvePeriod } from './period';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DAY_LIMIT = 50;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    private readonly accounts: AccountsService,
  ) {}

  async summary(userId: string, query: DashboardQueryDto): Promise<SummaryResponseDto> {
    const period = this.periodOf(query);
    const previous = previousPeriod(period);

    const [current, before] = await Promise.all([
      this.totals(userId, query, period),
      this.totals(userId, query, previous),
    ]);

    return {
      period: describe(period),
      income: current.income,
      expense: current.expense,
      net: current.net,
      count: current.count,
      previous: { income: before.income, expense: before.expense, net: before.net },
      savingsRate: current.income > 0 ? current.net / current.income : null,
    };
  }

  async byCategory(userId: string, query: DashboardQueryDto): Promise<ByCategoryResponseDto> {
    const period = this.periodOf(query);
    const months = competencesIn(period).length;

    const [rows, leaves] = await Promise.all([
      this.realized(userId, query, period)
        .leftJoin('categories', 'leaf', 'leaf.id = t.category_id')
        .leftJoin('categories', 'c', 'c.id = COALESCE(leaf.parent_id, leaf.id)')
        .andWhere(`t.type = 'debit'`)
        .select('c.id', 'category_id')
        .addSelect('c.name', 'name')
        .addSelect('c.color', 'color')
        .addSelect('c.kind', 'kind')
        .addSelect('c.monthly_budget', 'monthly_budget')
        .addSelect('SUM(t.amount)::text', 'total')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('c.id')
        .addGroupBy('c.name')
        .addGroupBy('c.color')
        .addGroupBy('c.kind')
        .addGroupBy('c.monthly_budget')
        .orderBy('SUM(t.amount)', 'DESC')
        .getRawMany<{
          category_id: string | null;
          name: string | null;
          color: string | null;
          kind: string | null;
          monthly_budget: string | null;
          total: string;
          count: number;
        }>(),

      this.realized(userId, query, period)
        .leftJoin('categories', 'leaf', 'leaf.id = t.category_id')
        .andWhere(`t.type = 'debit'`)
        .select('COALESCE(leaf.parent_id, leaf.id)', 'parent_id')
        .addSelect('leaf.parent_id', 'leaf_parent_id')
        .addSelect('leaf.id', 'leaf_id')
        .addSelect('leaf.name', 'leaf_name')
        .addSelect('leaf.color', 'leaf_color')
        .addSelect('SUM(t.amount)::text', 'total')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('leaf.id')
        .addGroupBy('leaf.parent_id')
        .addGroupBy('leaf.name')
        .addGroupBy('leaf.color')
        .orderBy('SUM(t.amount)', 'DESC')
        .getRawMany<{
          parent_id: string | null;
          leaf_parent_id: string | null;
          leaf_id: string | null;
          leaf_name: string | null;
          leaf_color: string | null;
          total: string;
          count: number;
        }>(),
    ]);

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);

    const children = new Map<string, CategoryChildDto[]>();
    for (const leaf of leaves) {
      const key = leaf.parent_id ?? '';
      const bucket = children.get(key) ?? [];

      bucket.push({
        categoryId: leaf.leaf_parent_id === null ? null : leaf.leaf_id,
        name: leaf.leaf_parent_id === null ? null : leaf.leaf_name,
        color: leaf.leaf_parent_id === null ? null : leaf.leaf_color,
        total: Number(leaf.total),
        share: 0,
        count: leaf.count,
      });

      children.set(key, bucket);
    }

    const slices: CategorySliceDto[] = rows.map((row) => {
      const sliceTotal = Number(row.total);
      const bucket = children.get(row.category_id ?? '') ?? [];

      return {
        categoryId: row.category_id,
        name: row.name ?? 'Sem categoria',
        color: row.color,
        kind: (row.kind as CategorySliceDto['kind']) ?? null,
        total: sliceTotal,
        share: total > 0 ? sliceTotal / total : 0,
        count: row.count,
        budget: row.monthly_budget === null ? null : Number(row.monthly_budget) * months,
        children: bucket.map((child) => ({
          ...child,
          share: sliceTotal > 0 ? child.total / sliceTotal : 0,
        })),
      };
    });

    return { period: describe(period), total, slices };
  }

  async byAccount(userId: string, query: DashboardQueryDto): Promise<ByAccountResponseDto> {
    const period = this.periodOf(query);

    const [rows, accounts] = await Promise.all([
      this.realized(userId, query, period)
        .andWhere(`t.type IN ('credit', 'debit')`)
        .select('t.account_id', 'account_id')
        .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)::text`, 'expense')
        .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::text`, 'income')
        .addSelect(`CAST(COUNT(*) FILTER (WHERE t.type = 'debit') AS int)`, 'count')
        .addSelect(
          `CAST(SUM(SUM(t.amount) FILTER (WHERE t.type = 'debit')) OVER () AS text)`,
          'grand_total',
        )
        .groupBy('t.account_id')
        .orderBy(`SUM(t.amount) FILTER (WHERE t.type = 'debit')`, 'DESC', 'NULLS LAST')
        .getRawMany<{
          account_id: string;
          expense: string;
          income: string;
          count: number;
          grand_total: string | null;
        }>(),
      this.accounts.list(userId, true),
    ]);

    const moved = new Map(rows.map((row) => [row.account_id, row]));
    const total = Number(rows[0]?.grand_total ?? 0);

    const selected = query.accountId?.length ? new Set(query.accountId) : null;

    const slices: AccountSliceDto[] = accounts
      .filter((account) =>
        selected ? selected.has(account.id) : account.archivedAt === null || moved.has(account.id),
      )
      .map((account) => {
        const row = moved.get(account.id);
        const expense = Number(row?.expense ?? 0);

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          icon: account.icon ?? null,
          currency: account.currency,
          archived: account.archivedAt !== null,
          expense,
          income: Number(row?.income ?? 0),
          count: row?.count ?? 0,
          share: total > 0 ? expense / total : 0,
        };
      })
      .sort((a, b) => b.expense - a.expense || a.name.localeCompare(b.name, 'pt-BR'));

    return { period: describe(period), total, accounts: slices };
  }

  async balanceSeries(userId: string, query: DashboardQueryDto): Promise<BalanceSeriesResponseDto> {
    const period = this.periodOf(query);

    const daily = this.realized(userId, query, period)
      .select(`date_trunc('day', t.occurred_at AT TIME ZONE 'UTC')`, 'day')
      .addSelect(
        `SUM(CASE WHEN t.type = 'credit' THEN t.amount WHEN t.type = 'debit' THEN -t.amount ELSE 0 END)`,
        'net',
      )
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)`, 'income')
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)`, 'expense')
      .groupBy('1');

    const [sql, parameters] = daily.getQueryAndParameters() as [string, unknown[]];

    const rows = await this.transactions.query<
      Array<{ day: string; net: string; income: string; expense: string; running: string }>
    >(
      `
      WITH daily AS (${sql}),
           days AS (
             SELECT generate_series(
               date_trunc('day', $${parameters.length + 1}::timestamptz AT TIME ZONE 'UTC'),
               date_trunc('day', $${parameters.length + 2}::timestamptz AT TIME ZONE 'UTC'),
               interval '1 day'
             ) AS day
           )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(daily.net, 0)::text AS net,
             COALESCE(daily.income, 0)::text AS income,
             COALESCE(daily.expense, 0)::text AS expense,
             SUM(COALESCE(daily.net, 0)) OVER (ORDER BY d.day)::text AS running
        FROM days d
        LEFT JOIN daily ON daily.day = d.day
       ORDER BY d.day
      `,
      [...parameters, period.from, period.to],
    );

    const points: BalancePointDto[] = rows.map((row) => ({
      date: row.day,
      net: Number(row.net),
      income: Number(row.income),
      expense: Number(row.expense),
      cumulative: Number(row.running),
    }));

    return { period: describe(period), points };
  }

  async day(userId: string, query: DayQueryDto): Promise<DayResponseDto> {
    const period = this.periodOf(query);

    const start = new Date(`${query.date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + DAY_IN_MS);

    const ofTheDay = (): SelectQueryBuilder<Transaction> =>
      this.realized(userId, query, period)
        .andWhere('t.occurred_at >= :dayStart', { dayStart: start })
        .andWhere('t.occurred_at < :dayEnd', { dayEnd: end });

    const [totals, rows] = await Promise.all([
      ofTheDay()
        .select(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::text`, 'income')
        .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)::text`, 'expense')
        .addSelect('COUNT(*)::int', 'count')
        .getRawOne<{ income: string; expense: string; count: number }>(),

      ofTheDay()
        .leftJoin('accounts', 'a', 'a.id = t.account_id')
        .leftJoin('categories', 'c', 'c.id = t.category_id')
        .select('t.id', 'id')
        .addSelect('t.type', 'type')
        .addSelect('t.amount::text', 'amount')
        .addSelect('t.currency', 'currency')
        .addSelect('t.description', 'description')
        .addSelect('t.occurred_at', 'occurred_at')
        .addSelect('t.account_id', 'account_id')
        .addSelect('a.name', 'account_name')
        .addSelect('a.icon', 'account_icon')
        .addSelect('t.category_id', 'category_id')
        .addSelect('c.name', 'category_name')
        .addSelect('c.color', 'category_color')
        .orderBy('t.amount', 'DESC')
        .addOrderBy('t.occurred_at', 'DESC')
        .limit(DAY_LIMIT)
        .getRawMany<{
          id: string;
          type: string;
          amount: string;
          currency: string;
          description: string;
          occurred_at: Date;
          account_id: string;
          account_name: string | null;
          account_icon: string | null;
          category_id: string | null;
          category_name: string | null;
          category_color: string | null;
        }>(),
    ]);

    const income = Number(totals?.income ?? 0);
    const expense = Number(totals?.expense ?? 0);

    return {
      date: query.date,
      income,
      expense,
      net: income - expense,
      count: totals?.count ?? 0,
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type as DayTransactionDto['type'],
        amount: Number(row.amount),
        currency: row.currency,
        description: row.description,
        occurredAt: row.occurred_at.toISOString(),
        accountId: row.account_id,
        accountName: row.account_name ?? 'Conta',
        accountIcon: row.account_icon,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryColor: row.category_color,
      })),
    };
  }

  async monthlyComparison(
    userId: string,
    query: DashboardQueryDto,
  ): Promise<MonthlyComparisonResponseDto> {
    const period = this.periodOf(query);

    const rows = await this.realized(userId, query, period)
      .select(`to_char(t.competence, 'YYYY-MM-DD')`, 'competence')
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::text`, 'income')
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)::text`, 'expense')
      .groupBy('1')
      .getRawMany<{ competence: string; income: string; expense: string }>();

    const found = new Map(rows.map((row) => [row.competence, row]));

    const months: MonthlyPointDto[] = competencesIn(period).map((competence) => {
      const row = found.get(competence);
      const income = Number(row?.income ?? 0);
      const expense = Number(row?.expense ?? 0);
      return { competence, income, expense, net: income - expense };
    });

    return { period: describe(period), months };
  }

  async topMerchants(
    userId: string,
    query: DashboardQueryDto,
    limit = 8,
  ): Promise<TopMerchantsResponseDto> {
    const period = this.periodOf(query);

    const rows = await this.realized(userId, query, period)
      .andWhere(`t.type = 'debit'`)
      .select('btrim(t.description)', 'description')
      .addSelect('SUM(t.amount)::text', 'total')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('1')
      .orderBy('SUM(t.amount)', 'DESC')
      .limit(limit)
      .getRawMany<{ description: string; total: string; count: number }>();

    return {
      period: describe(period),
      merchants: rows.map((row) => ({
        description: row.description,
        total: Number(row.total),
        count: row.count,
      })),
    };
  }

  async projection(userId: string, query: DashboardQueryDto): Promise<ProjectionResponseDto> {
    const now = new Date();
    const horizon = resolvePeriod(PeriodPreset.ThisMonth, now).to;

    const scheduled = this.transactions
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.occurred_at <= :horizon', { horizon })
      .andWhere(`(t.occurred_at > :now OR t.status = 'pending')`, { now })
      .select(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::text`, 'income')
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)::text`, 'expense');

    if (query.accountId?.length) {
      applyTransactionFilters(scheduled, { accountId: query.accountId });
    }

    const [wallet, row] = await Promise.all([
      this.accounts.wallet(userId),
      scheduled.getRawOne<{ income: string; expense: string }>(),
    ]);

    const scheduledIncome = Number(row?.income ?? 0);
    const scheduledExpense = Number(row?.expense ?? 0);

    return {
      balance: wallet.balance,
      scheduledIncome,
      scheduledExpense,
      projected: wallet.balance + scheduledIncome - scheduledExpense,
      horizon: horizon.toISOString(),
    };
  }

  private periodOf(query: DashboardQueryDto): Period {
    return resolvePeriod(query.period ?? PeriodPreset.ThisMonth, new Date(), {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  private realized(
    userId: string,
    query: DashboardQueryDto,
    period: Period,
  ): SelectQueryBuilder<Transaction> {
    const qb = this.transactions
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere(`t.status = 'paid'`)
      .andWhere('t.occurred_at <= now()');

    const filter: TransactionFilter = { ...query, from: period.from, to: period.to };
    applyTransactionFilters(qb, filter);

    return qb;
  }

  private async totals(
    userId: string,
    query: DashboardQueryDto,
    period: Period,
  ): Promise<{ income: number; expense: number; net: number; count: number }> {
    const row = await this.realized(userId, query, period)
      .select(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::text`, 'income')
      .addSelect(`COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0)::text`, 'expense')
      .addSelect('COUNT(*)::int', 'count')
      .getRawOne<{ income: string; expense: string; count: number }>();

    const income = Number(row?.income ?? 0);
    const expense = Number(row?.expense ?? 0);

    return { income, expense, net: income - expense, count: row?.count ?? 0 };
  }
}

function describe(period: Period): PeriodDto {
  return {
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    months: competencesIn(period).length,
  };
}

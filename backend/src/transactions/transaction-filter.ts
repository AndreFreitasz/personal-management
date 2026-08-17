import { SelectQueryBuilder } from 'typeorm';

import { Transaction, TransactionType } from './entities/transaction.entity';

export interface TransactionFilter {
  from?: string | Date;
  to?: string | Date;
  type?: TransactionType[];
  accountId?: string[];
  categoryId?: string[];
  excludeCategoryId?: string[];
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  uncategorized?: boolean;
}

export function applyTransactionFilters(
  qb: SelectQueryBuilder<Transaction>,
  filter: TransactionFilter,
  alias = 't',
): void {
  if (filter.from) {
    qb.andWhere(`${alias}.occurred_at >= :from`, { from: new Date(filter.from) });
  }
  if (filter.to) {
    qb.andWhere(`${alias}.occurred_at <= :to`, { to: new Date(filter.to) });
  }
  if (filter.type?.length) {
    qb.andWhere(`${alias}.type IN (:...types)`, { types: filter.type });
  }
  if (filter.accountId?.length) {
    qb.andWhere(
      `(${alias}.account_id IN (:...accountIds) OR ${alias}.destination_account_id IN (:...accountIds))`,
      { accountIds: filter.accountId },
    );
  }
  if (filter.categoryId?.length) {
    qb.andWhere(`${alias}.category_id IN (:...categoryIds)`, { categoryIds: filter.categoryId });
  }
  if (filter.excludeCategoryId?.length) {
    qb.andWhere(
      `(${alias}.category_id IS NULL OR ${alias}.category_id NOT IN (:...excludedCategoryIds))`,
      { excludedCategoryIds: filter.excludeCategoryId },
    );
  }
  if (filter.minAmount !== undefined) {
    qb.andWhere(`${alias}.amount >= :minAmount`, { minAmount: filter.minAmount });
  }
  if (filter.maxAmount !== undefined) {
    qb.andWhere(`${alias}.amount <= :maxAmount`, { maxAmount: filter.maxAmount });
  }
  if (filter.search) {
    qb.andWhere(`${alias}.description ILIKE :search`, { search: `%${filter.search}%` });
  }
  if (filter.uncategorized !== undefined) {
    qb.andWhere(
      filter.uncategorized ? `${alias}.category_id IS NULL` : `${alias}.category_id IS NOT NULL`,
    );
  }
}

import { del, get, patch, post, query } from './api';

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  initialBalanceAt: string;
  currency: string;
  icon: string | null;
  archivedAt: string | null;
  balance?: number;
}

export interface Wallet {
  balance: number;
  currency: string;
  accounts: Account[];
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  credit_card: 'Cartão de crédito',
  cash: 'Dinheiro',
  investment: 'Investimento',
};

export const getWallet = () => get<Wallet>('/accounts/wallet');
export const listAccounts = () => get<Account[]>('/accounts');
export const createAccount = (body: {
  name: string;
  type: AccountType;
  initialBalance: number;
  initialBalanceAt: string;
  icon?: string;
}) => post<Account>('/accounts', body);

export const updateAccount = (
  id: string,
  body: { name?: string; type?: AccountType; icon?: string | null },
) => patch<Account>(`/accounts/${id}`, body);

export const archiveAccount = (id: string) => post<Account>(`/accounts/${id}/archive`);

export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  isDefault: boolean;
  monthlyBudget: number | null;
  archivedAt: string | null;
}

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  expense: 'Gasto',
  income: 'Entrada',
  transfer: 'Transferência',
};

export const listCategories = () => get<Category[]>('/categories');
export const createCategory = (body: {
  name: string;
  kind: CategoryKind;
  color?: string;
  parentId?: string;
  monthlyBudget?: number;
}) => post<Category>('/categories', body);
export const updateCategory = (
  id: string,
  body: { name?: string; monthlyBudget?: number | null },
) => patch<Category>(`/categories/${id}`, body);
export const archiveCategory = (id: string, reassignToId?: string) =>
  post<Category>(`/categories/${id}/archive`, reassignToId ? { reassignToId } : {});

export interface CategoryUsageTransaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  type: TransactionType;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface CategoryUsageRecurrence {
  id: string;
  description: string;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
}

export interface CategoryUsage {
  categoryIds: string[];
  children: Category[];
  transactionCount: number;
  recurrenceCount: number;
  transactions: CategoryUsageTransaction[];
  recurrences: CategoryUsageRecurrence[];
}

export const getCategoryUsage = (id: string) => get<CategoryUsage>(`/categories/${id}/usage`);

export const deleteCategory = (id: string, reassignTo?: string | null) =>
  del(`/categories/${id}`, reassignTo === undefined ? {} : { reassignToId: reassignTo });

export type TransactionType = 'credit' | 'debit' | 'transfer';

export type TransactionStatus = 'pending' | 'paid';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  occurredAt: string;
  competence: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  status: TransactionStatus;
  classificationSource: 'rule' | 'cache' | 'llm' | 'manual' | null;
  classifiedAt: string | null;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  credit: 'Entrada',
  debit: 'Saída',
  transfer: 'Transferência',
};

export const TRANSACTION_TYPE_HINT: Record<TransactionType, string> = {
  credit: 'Entra dinheiro novo na sua carteira.',
  debit: 'Sai da sua carteira. Investimento entra aqui, com a categoria Investimento.',
  transfer: 'Não altera seu saldo total — o dinheiro só muda de conta.',
};

export const TRANSACTION_TYPE_SIGN: Record<TransactionType, string> = {
  credit: '+',
  debit: '−',
  transfer: '→',
};

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export const listTransactions = (filters: TransactionFilters = {}) =>
  get<TransactionPage>(`/transactions${query({ limit: 25, ...filters })}`);

export const createTransaction = (body: {
  type: TransactionType;
  amount: number;
  description: string;
  occurredAt: string;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
}) => post<Transaction>('/transactions', body);

export const updateTransaction = (
  id: string,
  body: {
    type?: TransactionType;
    amount?: number;
    description?: string;
    occurredAt?: string;
    accountId?: string;
    destinationAccountId?: string | null;
    categoryId?: string | null;
    status?: TransactionStatus;
  },
) => patch<Transaction>(`/transactions/${id}`, body);

export const settleTransaction = (id: string, paid: boolean) =>
  updateTransaction(id, { status: paid ? 'paid' : 'pending' });

export const deleteTransaction = (id: string) => del(`/transactions/${id}`);
export const categorizeTransaction = (id: string, categoryId: string | null) =>
  post<Transaction>(`/transactions/${id}/categorize`, { categoryId });

export type ScheduleType = 'day_of_month' | 'fifth_business_day' | 'last_business_day';
export type Adjustment = 'none' | 'previous_business_day' | 'next_business_day';

export interface Recurrence {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  currency: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  scheduleType: ScheduleType;
  dayOfMonth: number | null;
  adjustment: Adjustment;
  startsOn: string;
  endsOn: string | null;
  installments: number | null;
  autoDebit: boolean;
  paused: boolean;
  materializedCount: number;
}

export interface Occurrence {
  competence: string;
  occursOn: string;
  amount: number;
  installment: number | null;
  materialized: boolean;
}

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  day_of_month: 'Dia fixo do mês',
  fifth_business_day: '5º dia útil',
  last_business_day: 'Último dia útil',
};

export const ADJUSTMENT_LABEL: Record<Adjustment, string> = {
  none: 'Mantém a data',
  previous_business_day: 'Antecipa para a sexta',
  next_business_day: 'Adia para a segunda',
};

export const ADJUSTMENT_HINT: Record<Adjustment, string> = {
  none: 'Cai no fim de semana e fica lá mesmo.',
  previous_business_day: 'O normal para salário: cai sábado, entra na sexta.',
  next_business_day: 'O normal para boleto: vence sábado, paga na segunda.',
};

export const RECURRENCE_TYPES: TransactionType[] = ['credit', 'debit'];

export const listRecurrences = (includePaused = false) =>
  get<Recurrence[]>(`/recurrences${query({ includePaused: includePaused || undefined })}`);

export const previewRecurrence = (id: string) => get<Occurrence[]>(`/recurrences/${id}/preview`);

export const createRecurrence = (body: {
  type: TransactionType;
  description: string;
  amount: number;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  scheduleType: ScheduleType;
  dayOfMonth?: number;
  adjustment?: Adjustment;
  startsOn: string;
  endsOn?: string;
  installments?: number;
  autoDebit?: boolean;
}) => post<Recurrence>('/recurrences', body);

export const updateRecurrence = (
  id: string,
  body: {
    description?: string;
    categoryId?: string | null;
    scheduleType?: ScheduleType;
    dayOfMonth?: number | null;
    adjustment?: Adjustment;
    endsOn?: string | null;
    autoDebit?: boolean;
  },
) => patch<Recurrence>(`/recurrences/${id}`, body);

export const pauseRecurrence = (id: string, paused: boolean) =>
  post<Recurrence>(`/recurrences/${id}/pause`, { paused });

export const adjustRecurrence = (id: string, amount: number, validFrom: string) =>
  post<Recurrence>(`/recurrences/${id}/adjust`, { amount, validFrom });

export const backfillRecurrence = (id: string) =>
  post<{ created: number }>(`/recurrences/${id}/backfill`);

export type PeriodPreset =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-12-months'
  | 'this-year'
  | 'custom';

export interface DashboardFilters {
  period?: PeriodPreset;
  from?: string;
  to?: string;
  type?: TransactionType[];
  accountId?: string[];
  categoryId?: string[];
  excludeCategoryId?: string[];
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface DashboardPeriod {
  from: string;
  to: string;
  months: number;
}

export interface DashboardSummary {
  period: DashboardPeriod;
  income: number;
  expense: number;
  net: number;
  count: number;
  previous: { income: number; expense: number; net: number };
  savingsRate: number | null;
}

export interface CategoryChild {
  categoryId: string | null;
  name: string | null;
  color: string | null;
  total: number;
  share: number;
  count: number;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  kind: CategoryKind | null;
  total: number;
  share: number;
  count: number;
  budget: number | null;
  children: CategoryChild[];
}

export interface ByCategory {
  period: DashboardPeriod;
  total: number;
  slices: CategorySlice[];
}

export interface AccountSlice {
  accountId: string;
  name: string;
  type: AccountType;
  icon: string | null;
  currency: string;
  archived: boolean;
  expense: number;
  income: number;
  count: number;
  share: number;
}

export interface ByAccount {
  period: DashboardPeriod;
  total: number;
  accounts: AccountSlice[];
}

export interface BalancePoint {
  date: string;
  net: number;
  income: number;
  expense: number;
  cumulative: number;
}

export interface BalanceSeries {
  period: DashboardPeriod;
  points: BalancePoint[];
}

export interface MonthlyPoint {
  competence: string;
  income: number;
  expense: number;
  net: number;
}

export interface MonthlyComparison {
  period: DashboardPeriod;
  months: MonthlyPoint[];
}

export interface Merchant {
  description: string;
  total: number;
  count: number;
}

export interface TopMerchants {
  period: DashboardPeriod;
  merchants: Merchant[];
}

export interface DayTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  occurredAt: string;
  accountId: string;
  accountName: string;
  accountIcon: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface DayDetail {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  transactions: DayTransaction[];
}

export interface Projection {
  balance: number;
  scheduledIncome: number;
  scheduledExpense: number;
  projected: number;
  horizon: string;
}

export function dashboardQuery(filters: DashboardFilters): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        search.append(key, String(item));
      }
    } else {
      search.set(key, String(value));
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const getSummary = (filters: DashboardFilters) =>
  get<DashboardSummary>(`/dashboard/summary${dashboardQuery(filters)}`);

export const getByCategory = (filters: DashboardFilters) =>
  get<ByCategory>(`/dashboard/by-category${dashboardQuery(filters)}`);

export const getDay = (filters: DashboardFilters, date: string) => {
  const recorte = dashboardQuery(filters);
  return get<DayDetail>(
    `/dashboard/day${recorte ? `${recorte}&` : '?'}date=${date}`,
  );
};

export const getByAccount = (filters: DashboardFilters) =>
  get<ByAccount>(`/dashboard/by-account${dashboardQuery(filters)}`);

export const getBalanceSeries = (filters: DashboardFilters) =>
  get<BalanceSeries>(`/dashboard/balance-series${dashboardQuery(filters)}`);

export const getMonthlyComparison = (filters: DashboardFilters) =>
  get<MonthlyComparison>(`/dashboard/monthly-comparison${dashboardQuery(filters)}`);

export const getTopMerchants = (filters: DashboardFilters) =>
  get<TopMerchants>(`/dashboard/top-merchants${dashboardQuery(filters)}`);

export const getProjection = (filters: DashboardFilters) =>
  get<Projection>(`/dashboard/projection${dashboardQuery(filters)}`);

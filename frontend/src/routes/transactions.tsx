import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DateField } from '@/components/date-field';
import { Amount, CategoryDot } from '@/components/money';
import { MoneyInput } from '@/components/money-input';
import {
  Button,
  Card,
  CategoryPicker,
  Collapse,
  ConfirmDialog,
  Empty,
  ErrorState,
  Field,
  Input,
  Loading,
  SectionHeader,
  Select,
} from '@/components/ui';
import { formatDate, todayForInput } from '@/lib/format';
import type { Account, Category, Transaction, TransactionType } from '@/lib/resources';
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  TRANSACTION_TYPE_HINT,
  TRANSACTION_TYPE_LABEL,
  updateTransaction,
} from '@/lib/resources';

const TYPES = Object.entries(TRANSACTION_TYPE_LABEL) as Array<[TransactionType, string]>;

function useDebouncedSearch(urlValue: string, commit: (next: string) => void, delay = 300) {
  const [draft, setDraft] = useState(urlValue);
  const settled = useRef(urlValue);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (draft === settled.current) return;

    const timer = setTimeout(() => {
      settled.current = draft;
      commitRef.current(draft);
    }, delay);

    return () => clearTimeout(timer);
  }, [draft, delay]);

  useEffect(() => {
    if (urlValue !== settled.current) {
      settled.current = urlValue;
      setDraft(urlValue);
    }
  }, [urlValue]);

  return [draft, setDraft] as const;
}

function EditTransactionForm({
  transaction,
  accounts,
  categories,
  pending,
  error,
  onCancel,
  onSave,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (body: Parameters<typeof updateTransaction>[1]) => void;
}) {
  const [type, setType] = useState<TransactionType>(transaction.type);

  const kindForType = type === 'credit' ? 'income' : type === 'debit' ? 'expense' : 'transfer';
  const eligible = categories.filter((c) => c.kind === kindForType);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const categoryId = String(data.get('categoryId') ?? '');
    const destination = String(data.get('destinationAccountId') ?? '');

    onSave({
      type,
      amount: Number(String(data.get('amount')).replace(',', '.')),
      description: String(data.get('description')),
      occurredAt: new Date(`${String(data.get('occurredAt'))}T12:00:00`).toISOString(),
      accountId: String(data.get('accountId')),
      categoryId: categoryId || null,
      destinationAccountId: type === 'transfer' ? destination : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-surface-sunken mt-3 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="Tipo" hint={TRANSACTION_TYPE_HINT[type]}>
        {(id) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Valor">
        {(id) => <MoneyInput id={id} name="amount" required defaultValue={transaction.amount} />}
      </Field>

      <Field label="Descrição">
        {(id) => (
          <Input
            id={id}
            name="description"
            required
            maxLength={255}
            defaultValue={transaction.description}
          />
        )}
      </Field>

      <Field label="Data">
        {(id) => (
          <DateField id={id} name="occurredAt" required defaultValue={transaction.occurredAt.slice(0, 10)} />
        )}
      </Field>

      <Field label={type === 'transfer' ? 'Conta de origem' : 'Conta'}>
        {(id) => (
          <Select id={id} name="accountId" required defaultValue={transaction.accountId}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type === 'transfer' && (
        <Field label="Conta de destino">
          {(id) => (
            <Select
              id={id}
              name="destinationAccountId"
              required
              defaultValue={transaction.destinationAccountId ?? ''}
            >
              <option value="">Escolha uma conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <CategoryPicker
        categories={eligible}
        resetKey={type}
        value={
          eligible.some((c) => c.id === transaction.categoryId)
            ? (transaction.categoryId ?? null)
            : null
        }
      />

      {error !== null && error !== undefined && (
        <p role="alert" className="text-negative text-sm sm:col-span-2 lg:col-span-3">
          {error instanceof Error ? error.message : 'Erro ao salvar.'}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('debit');
  const [confirming, setConfirming] = useState<{
    id: string;
    description: string;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showScheduled, setShowScheduled] = useState(false);

  const filters = {
    search: params.get('search') ?? '',
    type: (params.get('type') ?? '') as TransactionType | '',
    accountId: params.get('accountId') ?? '',
  };

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const [now] = useState(() => new Date().toISOString());

  const transactions = useInfiniteQuery({
    queryKey: ['transactions', filters],
    queryFn: ({ pageParam }) =>
      listTransactions({
        search: filters.search || undefined,
        type: filters.type || undefined,
        accountId: filters.accountId || undefined,
        to: now,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const scheduled = useInfiniteQuery({
    queryKey: ['transactions', 'scheduled', filters],
    queryFn: ({ pageParam }) =>
      listTransactions({
        search: filters.search || undefined,
        type: filters.type || undefined,
        accountId: filters.accountId || undefined,
        from: now,
        order: 'asc',
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const create = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: invalidate,
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(id, body),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const activeAccounts = accounts.data ?? [];
  const activeCategories = (categories.data ?? []).filter((c) => c.archivedAt === null);
  const kindForType = type === 'credit' ? 'income' : type === 'debit' ? 'expense' : 'transfer';
  const eligibleCategories = activeCategories.filter((c) => c.kind === kindForType);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const [searchDraft, setSearchDraft] = useDebouncedSearch(filters.search, (next) =>
    updateFilter('search', next),
  );

  const filtering = transactions.isPlaceholderData;
  const pendingFilter = filtering || searchDraft !== filters.search;

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const destination = String(data.get('destinationAccountId') ?? '');
    const category = String(data.get('categoryId') ?? '');

    create.mutate({
      type,
      amount: Number(String(data.get('amount')).replace(',', '.')),
      description: String(data.get('description')),
      occurredAt: new Date(`${String(data.get('occurredAt'))}T12:00:00`).toISOString(),
      accountId: String(data.get('accountId')),
      ...(type === 'transfer' && destination ? { destinationAccountId: destination } : {}),
      ...(category ? { categoryId: category } : {}),
    });
  }

  const renderRow = (transaction: Transaction) => {
    const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
    const account = accountById.get(transaction.accountId);

    return (
      <li
        key={transaction.id}
        className="row-leave"
        data-leaving={remove.isPending && remove.variables === transaction.id}
      >
        <div className="flex items-start gap-3 py-3 sm:items-baseline sm:gap-4">
          <span className="text-ink-muted tnum hidden w-20 shrink-0 text-xs sm:block">
            {formatDate(transaction.occurredAt)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm font-medium">{transaction.description}</p>
            <p className="text-ink-muted flex flex-wrap items-center gap-x-1.5 text-xs">
              <span className="tnum sm:hidden">{formatDate(transaction.occurredAt)} ·</span>
              {category ? (
                <>
                  <CategoryDot color={category.color} kind={category.kind} />
                  {category.name}
                </>
              ) : (
                <span className="italic">Sem categoria</span>
              )}
              {account && <span>· {account.name}</span>}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <p className="text-sm font-medium">
              <Amount
                value={transaction.amount}
                type={transaction.type}
                currency={transaction.currency}
              />
            </p>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={() =>
                  setEditing((current) => (current === transaction.id ? null : transaction.id))
                }
                aria-expanded={editing === transaction.id}
              >
                {editing === transaction.id ? 'Fechar' : 'Editar'}
              </Button>

              <Button
                variant="danger"
                onClick={() =>
                  setConfirming({
                    id: transaction.id,
                    description: transaction.description,
                  })
                }
                disabled={remove.isPending}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>

        <Collapse open={editing === transaction.id}>
          <EditTransactionForm
            transaction={transaction}
            accounts={activeAccounts}
            categories={activeCategories}
            pending={edit.isPending}
            error={edit.error}
            onCancel={() => setEditing(null)}
            onSave={(body) => edit.mutate({ id: transaction.id, body })}
          />
        </Collapse>
      </li>
    );
  };

  const pages = transactions.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const scheduledItems = (scheduled.data?.pages ?? []).flatMap((page) => page.items);
  const categoryById = new Map(activeCategories.map((c) => [c.id, c]));
  const accountById = new Map(activeAccounts.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-6">
      <Card className="animate-rise">
        <SectionHeader
          title="Lançamentos"
          description="Tudo que entrou, saiu ou mudou de lugar."
          action={
            <Button
              variant="secondary"
              onClick={() => setOpen((v) => !v)}
              disabled={activeAccounts.length === 0}
            >
              {open ? 'Cancelar' : 'Novo lançamento'}
            </Button>
          }
        />

        <Collapse open={open}>
          <form
            onSubmit={handleCreate}
            className="border-border bg-surface-sunken mb-5 grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Tipo" hint={TRANSACTION_TYPE_HINT[type]}>
              {(id) => (
                <Select
                  id={id}
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                >
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Valor" hint="Sempre positivo — o tipo acima define o sinal.">
              {(id) => <MoneyInput id={id} name="amount" required />}
            </Field>

            <Field label="Descrição">
              {(id) => <Input id={id} name="description" required maxLength={255} />}
            </Field>

            <Field label="Data">
              {(id) => <DateField id={id} name="occurredAt" required defaultValue={todayForInput()} />}
            </Field>

            <Field label={type === 'transfer' ? 'Conta de origem' : 'Conta'}>
              {(id) => (
                <Select id={id} name="accountId" required>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {type === 'transfer' && (
              <Field label="Conta de destino" hint="Obrigatória: o dinheiro muda de lugar.">
                {(id) => (
                  <Select id={id} name="destinationAccountId" required>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            <CategoryPicker
              categories={eligibleCategories}
              resetKey={type}
              value={null}
              hint="Opcional — dá para classificar depois."
            />

            {create.isError && (
              <p role="alert" className="text-negative text-sm sm:col-span-2 lg:col-span-3">
                {create.error instanceof Error ? create.error.message : 'Erro ao lançar.'}
              </p>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Salvando…' : 'Lançar'}
              </Button>
            </div>
          </form>
        </Collapse>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Field label="Buscar">
            {(id) => (
              <Input
                id={id}
                type="search"
                placeholder="Descrição"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            )}
          </Field>

          <Field label="Tipo">
            {(id) => (
              <Select
                id={id}
                value={filters.type}
                onChange={(e) => updateFilter('type', e.target.value)}
              >
                <option value="">Todos</option>
                {TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Conta">
            {(id) => (
              <Select
                id={id}
                value={filters.accountId}
                onChange={(e) => updateFilter('accountId', e.target.value)}
              >
                <option value="">Todas</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <p role="status" className="text-ink-muted mb-3 h-4 text-xs">
          {pendingFilter ? 'Filtrando…' : ''}
        </p>

        {scheduledItems.length > 0 && (
          <div className="border-border bg-surface-sunken mb-4 overflow-hidden rounded-xl border">
            <button
              type="button"
              onClick={() => setShowScheduled((value) => !value)}
              aria-expanded={showScheduled}
              className="tap hover:bg-primary-soft/40 flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="bg-primary-soft text-primary-ink tnum grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">
                {scheduledItems.length}
                {scheduled.hasNextPage && '+'}
              </span>

              <span className="min-w-0 flex-1">
                <span className="text-ink block text-sm font-medium">
                  {scheduledItems.length === 1 ? 'Lançamento agendado' : 'Lançamentos agendados'}
                </span>
                <span className="text-ink-muted block text-xs">
                  Próximo em {formatDate(scheduledItems[0].occurredAt)} · fora do saldo até
                  acontecer
                </span>
              </span>

              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="text-ink-muted size-4 shrink-0"
                style={{
                  transform: showScheduled ? 'rotate(180deg)' : 'none',
                  transition: 'transform var(--motion-settle) var(--ease-ios-spring)',
                }}
              >
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <Collapse open={showScheduled}>
              <div className="border-border border-t px-4">
                <ul className="divide-border divide-y">{scheduledItems.map(renderRow)}</ul>

                {scheduled.hasNextPage && (
                  <div className="pb-3">
                    <Button
                      variant="secondary"
                      onClick={() => void scheduled.fetchNextPage()}
                      disabled={scheduled.isFetchingNextPage}
                    >
                      {scheduled.isFetchingNextPage ? 'Carregando…' : 'Ver mais agendados'}
                    </Button>
                  </div>
                )}
              </div>
            </Collapse>
          </div>
        )}

        <div className="filtering" data-busy={filtering ? 'true' : 'false'}>
          {transactions.isPending && <Loading label="Buscando lançamentos…" />}
          {transactions.isError && (
            <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
          )}

          {transactions.data && items.length === 0 && (
            <Empty
              title={
                filters.search || filters.type || filters.accountId
                  ? 'Nada com esse filtro'
                  : scheduledItems.length > 0
                    ? 'Nada aconteceu ainda'
                    : 'Nenhum lançamento ainda'
              }
              hint={
                activeAccounts.length === 0
                  ? 'Crie uma conta na Carteira primeiro — todo lançamento sai de alguma conta.'
                  : scheduledItems.length > 0
                    ? 'O que você registrou está agendado para a frente — abra a lista acima para ver.'
                    : 'Registre a primeira entrada ou saída para o saldo começar a fazer sentido.'
              }
              action={
                activeAccounts.length > 0 ? (
                  <Button onClick={() => setOpen(true)}>Novo lançamento</Button>
                ) : undefined
              }
            />
          )}

          {items.length > 0 && (
            <>
              <ul className="divide-border divide-y">{items.map(renderRow)}</ul>

              {transactions.hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => void transactions.fetchNextPage()}
                    disabled={transactions.isFetchingNextPage}
                  >
                    {transactions.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming !== null}
        title="Excluir lançamento?"
        description={
          confirming
            ? `"${confirming.description}" sai do extrato e o saldo é recalculado. Não dá para desfazer.`
            : ''
        }
        confirmLabel="Excluir"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.mutate(confirming.id);
          setConfirming(null);
        }}
      />
    </div>
  );
}

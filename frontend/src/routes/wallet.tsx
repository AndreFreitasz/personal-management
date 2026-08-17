import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AccountIcon, AccountIconField, AccountIconPicker } from '@/components/account-icon';
import { DateField } from '@/components/date-field';
import { MoneyInput } from '@/components/money-input';
import { Balance } from '@/components/money';
import {
  Button,
  Card,
  Collapse,
  Empty,
  ErrorState,
  Field,
  Input,
  Loading,
  SectionHeader,
  Select,
} from '@/components/ui';
import { formatDate, formatMoney, todayForInput } from '@/lib/format';
import type { Account, AccountType } from '@/lib/resources';
import {
  ACCOUNT_TYPE_LABEL,
  archiveAccount,
  createAccount,
  getWallet,
  updateAccount,
} from '@/lib/resources';

const TYPES = Object.entries(ACCOUNT_TYPE_LABEL) as Array<[AccountType, string]>;

export function WalletPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [icon, setIcon] = useState<string | null>(null);
  const [name, setName] = useState('');

  const [editing, setEditing] = useState<Account | null>(null);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: getWallet });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      setOpen(false);
      setIcon(null);
      setName('');
      invalidate();
    },
  });

  const archive = useMutation({ mutationFn: archiveAccount, onSuccess: invalidate });

  const changeIcon = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) =>
      updateAccount(id, { icon }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    create.mutate({
      name: String(data.get('name')),
      type: data.get('type') as AccountType,
      initialBalance: Number(String(data.get('initialBalance')).replace(',', '.')) || 0,
      initialBalanceAt: String(data.get('initialBalanceAt')),
      ...(icon ? { icon } : {}),
    });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card className="animate-rise shadow-card-hero from-primary-soft/50 relative overflow-hidden bg-linear-to-b to-transparent">
        <div aria-hidden="true" className="guilloche absolute inset-x-0 top-0 h-1 opacity-70" />

        <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
          Saldo consolidado
        </p>

        {wallet.isPending && <Loading label="Somando suas contas…" />}
        {wallet.isError && <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />}

        {wallet.data && (
          <>
            <p className="font-display mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              <Balance value={wallet.data.balance} currency={wallet.data.currency} />
            </p>

            <p className="text-ink-muted mt-2 flex items-center gap-1.5 text-xs">
              <span aria-hidden="true" className="bg-positive inline-block size-1.5 rounded-full" />
              {wallet.data.accounts.length === 1
                ? '1 conta ativa'
                : `${wallet.data.accounts.length} contas ativas`}
            </p>

            <p className="text-ink-muted mt-3 text-sm">
              Soma das contas ativas, hoje. Lançamentos com data futura ficam de fora, e
              transferência entre contas suas não altera este total.
            </p>
          </>
        )}
      </Card>

      <Card className="animate-rise" style={{ animationDelay: '90ms' }}>
        <SectionHeader
          title="Contas"
          description="De onde o dinheiro sai e para onde entra."
          action={
            <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? 'Cancelar' : 'Nova conta'}
            </Button>
          }
        />

        <Collapse open={open}>
          <form
            onSubmit={handleCreate}
            className="border-border bg-surface-sunken mb-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2"
          >
            <Field label="Nome">
              {(id) => (
                <Input
                  id={id}
                  name="name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>

            <Field label="Tipo">
              {(id) => (
                <Select id={id} name="type" defaultValue="checking">
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Saldo inicial" hint="Quanto havia na conta na data abaixo.">
              {(id) => <MoneyInput id={id} name="initialBalance" />}
            </Field>

            <Field label="Data do saldo inicial" hint="Lançamentos anteriores não entram na conta.">
              {(id) => (
                <DateField id={id} name="initialBalanceAt" required defaultValue={todayForInput()} />
              )}
            </Field>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <p className="text-ink text-sm font-medium">Marca</p>
              <AccountIconField value={icon} accountName={name} onChange={setIcon} />
              <p className="text-ink-muted text-xs">
                O desenho que identifica a conta na carteira, nos filtros e no painel.
              </p>
            </div>

            {create.isError && (
              <p role="alert" className="text-negative text-sm sm:col-span-2">
                {create.error instanceof Error ? create.error.message : 'Erro ao criar a conta.'}
              </p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar conta'}
              </Button>
            </div>
          </form>
        </Collapse>

        {wallet.isPending && <Loading />}
        {wallet.isError && <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />}

        {wallet.data?.accounts.length === 0 && (
          <Empty
            title="Nenhuma conta ainda"
            hint="Crie a primeira conta — corrente, cartão ou dinheiro vivo — para começar a lançar."
            action={<Button onClick={() => setOpen(true)}>Nova conta</Button>}
          />
        )}

        {wallet.data && wallet.data.accounts.length > 0 && (
          <ul className="divide-border divide-y">
            {wallet.data.accounts.map((account) => (
              <li
                key={account.id}
                className="row-leave"
                data-leaving={archive.isPending && archive.variables === account.id}
              >
                <div className="flex items-start gap-3 py-3 sm:items-center sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setEditing(account)}
                    aria-label={`Trocar a marca de ${account.name}`}
                    title="Trocar a marca"
                    className="tap hover:ring-primary shrink-0 rounded-[10px] hover:ring-2"
                  >
                    <AccountIcon icon={account.icon} name={account.name} size="lg" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm font-medium">{account.name}</p>
                    <p className="text-ink-muted text-xs">
                      {ACCOUNT_TYPE_LABEL[account.type]} · início em{' '}
                      {formatDate(`${account.initialBalanceAt}T00:00:00.000Z`)} com{' '}
                      {formatMoney(account.initialBalance, account.currency)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                    <p className="text-sm font-medium">
                      <Balance value={account.balance ?? 0} currency={account.currency} />
                    </p>

                    <Button
                      variant="ghost"
                      onClick={() => archive.mutate(account.id)}
                      disabled={archive.isPending}
                      title="Arquivar: some da lista, o histórico permanece"
                    >
                      Arquivar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <AccountIconPicker
          open={editing !== null}
          value={editing?.icon ?? null}
          accountName={editing?.name ?? ''}
          onPick={(slug) =>
            editing && changeIcon.mutate({ id: editing.id, icon: slug })
          }
          onClose={() => setEditing(null)}
        />

        {changeIcon.isError && (
          <p role="alert" className="text-negative mt-3 text-sm">
            {changeIcon.error instanceof Error
              ? changeIcon.error.message
              : 'Erro ao trocar a marca da conta.'}
          </p>
        )}
      </Card>
    </div>
  );
}

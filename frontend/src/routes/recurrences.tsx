import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { MonthField } from '@/components/date-field';
import { CategoryDot } from '@/components/money';
import { MoneyInput } from '@/components/money-input';
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
import { formatCompetence, formatDay, formatMoney } from '@/lib/format';
import type {
  Adjustment,
  Category,
  Recurrence,
  ScheduleType,
  TransactionType,
} from '@/lib/resources';
import {
  ADJUSTMENT_HINT,
  ADJUSTMENT_LABEL,
  adjustRecurrence,
  backfillRecurrence,
  createRecurrence,
  listAccounts,
  listCategories,
  listRecurrences,
  pauseRecurrence,
  previewRecurrence,
  RECURRENCE_TYPES,
  SCHEDULE_TYPE_LABEL,
  TRANSACTION_TYPE_HINT,
  TRANSACTION_TYPE_LABEL,
  TRANSACTION_TYPE_SIGN,
  updateRecurrence,
} from '@/lib/resources';

const SCHEDULES = Object.entries(SCHEDULE_TYPE_LABEL) as Array<[ScheduleType, string]>;
const ADJUSTMENTS = Object.entries(ADJUSTMENT_LABEL) as Array<[Adjustment, string]>;

type EndMode = 'never' | 'until' | 'installments';

function scheduleSentence(recurrence: Recurrence): string {
  const quando =
    recurrence.scheduleType === 'day_of_month'
      ? `todo dia ${recurrence.dayOfMonth}`
      : recurrence.scheduleType === 'fifth_business_day'
        ? 'todo 5º dia útil'
        : 'todo último dia útil';

  const ajuste =
    recurrence.adjustment === 'previous_business_day'
      ? ', antecipando quando cair no fim de semana'
      : recurrence.adjustment === 'next_business_day'
        ? ', adiando quando cair no fim de semana'
        : '';

  return `${quando}${ajuste}`;
}

function windowSentence(recurrence: Recurrence): string {
  if (recurrence.installments !== null) {
    return `${recurrence.materializedCount} de ${recurrence.installments} parcelas lançadas`;
  }
  if (recurrence.endsOn !== null) {
    return `até ${formatCompetence(recurrence.endsOn)}`;
  }
  return 'por tempo indeterminado';
}

export function RecurrencesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('credit');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('fifth_business_day');
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const recurrences = useQuery({ queryKey: ['recurrences'], queryFn: () => listRecurrences(true) });
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts });
  const categories = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['recurrences'] });
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const create = useMutation({
    mutationFn: createRecurrence,
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
  });

  const pause = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) => pauseRecurrence(id, paused),
    onSuccess: invalidate,
  });

  const backfill = useMutation({ mutationFn: backfillRecurrence, onSuccess: invalidate });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateRecurrence>[1] }) =>
      updateRecurrence(id, body),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const adjust = useMutation({
    mutationFn: ({ id, amount, validFrom }: { id: string; amount: number; validFrom: string }) =>
      adjustRecurrence(id, amount, validFrom),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const activeAccounts = accounts.data ?? [];
  const activeCategories = (categories.data ?? []).filter((c) => c.archivedAt === null);
  const kindForType = type === 'credit' ? 'income' : 'expense';
  const eligibleCategories = activeCategories.filter((c) => c.kind === kindForType);

  const items = recurrences.data ?? [];
  const accountById = new Map(activeAccounts.map((a) => [a.id, a]));
  const categoryById = new Map(activeCategories.map((c) => [c.id, c]));

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const category = String(data.get('categoryId') ?? '');
    const endsOn = String(data.get('endsOn') ?? '');
    const installments = String(data.get('installments') ?? '');

    create.mutate({
      type,
      description: String(data.get('description')),
      amount: Number(String(data.get('amount')).replace(',', '.')),
      accountId: String(data.get('accountId')),
      scheduleType,
      adjustment: String(data.get('adjustment')) as Adjustment,
      startsOn: String(data.get('startsOn')),
      ...(scheduleType === 'day_of_month' ? { dayOfMonth: Number(data.get('dayOfMonth')) } : {}),
      ...(category ? { categoryId: category } : {}),
      ...(endMode === 'until' && endsOn ? { endsOn } : {}),
      ...(endMode === 'installments' && installments ? { installments: Number(installments) } : {}),
      ...(type === 'debit' ? { autoDebit: data.get('autoDebit') === 'on' } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="animate-rise">
        <SectionHeader
          title="Recorrências"
          description="O que entra e sai sozinho, todo mês, sem você lançar."
          action={
            <Button
              variant="secondary"
              onClick={() => setOpen((v) => !v)}
              disabled={activeAccounts.length === 0}
            >
              {open ? 'Cancelar' : 'Nova recorrência'}
            </Button>
          }
        />

        <Collapse open={open}>
          <form
            onSubmit={handleCreate}
            className="border-border bg-surface-sunken mb-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Tipo" hint={TRANSACTION_TYPE_HINT[type]}>
              {(id) => (
                <Select
                  id={id}
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                >
                  {RECURRENCE_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {TRANSACTION_TYPE_LABEL[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Descrição" hint="Como vai aparecer no extrato.">
              {(id) => <Input id={id} name="description" required maxLength={255} />}
            </Field>

            <Field label="Valor" hint="Sempre positivo — o tipo acima define o sinal.">
              {(id) => <MoneyInput id={id} name="amount" required />}
            </Field>

            <Field label="Conta">
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

            <Field
              label="Categoria"
              hint={
                type === 'debit'
                  ? 'Aporte mensal? Escolha Investimento — o dashboard soma isso.'
                  : 'Opcional — dá para classificar depois.'
              }
            >
              {(id) => (
                <Select id={id} name="categoryId" defaultValue="">
                  <option value="">Sem categoria</option>
                  {eligibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Quando">
              {(id) => (
                <Select
                  id={id}
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                >
                  {SCHEDULES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {scheduleType === 'day_of_month' && (
              <Field label="Dia do mês" hint="31 vale: em fevereiro cai no dia 28 ou 29.">
                {(id) => (
                  <Input id={id} name="dayOfMonth" type="number" min={1} max={31} required />
                )}
              </Field>
            )}

            <Field
              label="Se cair no fim de semana"
              hint={ADJUSTMENT_HINT[type === 'credit' ? 'previous_business_day' : 'next_business_day']}
            >
              {(id) => (
                <Select
                  id={id}
                  name="adjustment"
                  key={type}
                  defaultValue={type === 'credit' ? 'previous_business_day' : 'next_business_day'}
                >
                  {ADJUSTMENTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Começa em">
              {(id) => (
                <MonthField
                  id={id}
                  name="startsOn"
                  required
                  defaultValue={new Date().toISOString().slice(0, 7)}
                />
              )}
            </Field>

            <Field label="Termina">
              {(id) => (
                <Select
                  id={id}
                  value={endMode}
                  onChange={(e) => setEndMode(e.target.value as EndMode)}
                >
                  <option value="never">Não termina</option>
                  <option value="until">Em um mês específico</option>
                  <option value="installments">Depois de N parcelas</option>
                </Select>
              )}
            </Field>

            {endMode === 'until' && (
              <Field label="Último mês">
                {(id) => <MonthField id={id} name="endsOn" required />}
              </Field>
            )}

            {endMode === 'installments' && (
              <Field label="Parcelas" hint="12x começando em janeiro termina em dezembro.">
                {(id) => (
                  <Input id={id} name="installments" type="number" min={1} max={480} required />
                )}
              </Field>
            )}

            {type === 'debit' && (
              <label className="text-ink flex items-start gap-2.5 text-sm sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                name="autoDebit"
                className="accent-primary mt-0.5 size-4 shrink-0"
                
              />
              <span>
                Débito automático
                <span className="text-ink-muted mt-0.5 block text-xs">
                  Sai da conta na data, sem confirmação. Desmarcado, o gasto nasce previsto e
                  você confirma com “Dar baixa” na lista de lançamentos.
                </span>
              </span>
            </label>
            )}

            {create.isError && (
              <p role="alert" className="text-negative text-sm sm:col-span-2 lg:col-span-3">
                {create.error instanceof Error ? create.error.message : 'Erro ao criar.'}
              </p>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar recorrência'}
              </Button>
            </div>
          </form>
        </Collapse>

        {recurrences.isPending && <Loading label="Buscando suas recorrências…" />}
        {recurrences.isError && (
          <ErrorState error={recurrences.error} onRetry={() => void recurrences.refetch()} />
        )}

        {recurrences.data && items.length === 0 && (
          <Empty
            title="Nada no piloto automático ainda"
            hint={
              activeAccounts.length === 0
                ? 'Crie uma conta na Carteira primeiro — toda recorrência precisa de uma conta.'
                : 'Cadastre seu salário e as contas fixas. Elas passam a cair sozinhas, no dia certo.'
            }
            action={
              activeAccounts.length > 0 ? (
                <Button onClick={() => setOpen(true)}>Nova recorrência</Button>
              ) : undefined
            }
          />
        )}

        {items.length > 0 && (
          <ul className="divide-border divide-y">
            {items.map((recurrence) => {
              const account = accountById.get(recurrence.accountId);
              const category = recurrence.categoryId
                ? categoryById.get(recurrence.categoryId)
                : undefined;

              return (
                <li key={recurrence.id} className="py-3">
                  <div className="flex items-start gap-3 sm:items-baseline sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                        <span className="text-ink truncate">{recurrence.description}</span>
                        {recurrence.paused && (
                          <span className="border-border text-ink-muted rounded-full border px-2 py-0.5 text-xs font-normal">
                            Pausada
                          </span>
                        )}
                      </p>

                      <p className="text-ink-muted mt-0.5 text-xs">
                        {scheduleSentence(recurrence)} · {windowSentence(recurrence)}
                      </p>

                      <p className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
                        {category ? (
                          <>
                            <CategoryDot color={category.color} kind={category.kind} />
                            {category.name}
                          </>
                        ) : (
                          <span className="italic">Sem categoria</span>
                        )}
                        {account && <span>· {account.name}</span>}
                        {recurrence.autoDebit && <span>· Débito automático</span>}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-medium">
                        <span
                          className={`tnum ${
                            recurrence.type === 'credit'
                              ? 'text-positive'
                              : recurrence.type === 'debit'
                                ? 'text-negative'
                                : 'text-ink'
                          }`}
                        >
                          <span aria-hidden="true">{TRANSACTION_TYPE_SIGN[recurrence.type]}</span>
                          {formatMoney(recurrence.amount, recurrence.currency)}
                          <span className="sr-only">
                            {' '}
                            {TRANSACTION_TYPE_LABEL[recurrence.type]}
                          </span>
                        </span>
                      </p>
                      <p className="text-ink-muted text-xs">por mês</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setExpanded((current) =>
                          current === recurrence.id ? null : recurrence.id,
                        )
                      }
                      aria-expanded={expanded === recurrence.id}
                    >
                      {expanded === recurrence.id ? 'Ocultar próximos' : 'Ver próximos 12'}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditing((current) => (current === recurrence.id ? null : recurrence.id))
                      }
                      aria-expanded={editing === recurrence.id}
                    >
                      {editing === recurrence.id ? 'Fechar' : 'Editar'}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() =>
                        pause.mutate({ id: recurrence.id, paused: !recurrence.paused })
                      }
                      disabled={pause.isPending}
                    >
                      {recurrence.paused ? 'Retomar' : 'Pausar'}
                    </Button>

                    {recurrence.startsOn < new Date().toISOString().slice(0, 7) &&
                      recurrence.materializedCount === 0 && (
                        <Button
                          variant="ghost"
                          onClick={() => backfill.mutate(recurrence.id)}
                          disabled={backfill.isPending}
                          title="Cria os lançamentos dos meses entre o início e hoje"
                        >
                          Gerar meses anteriores
                        </Button>
                      )}
                  </div>

                  <Collapse open={editing === recurrence.id}>
                    <EditRecurrenceForm
                      recurrence={recurrence}
                      categories={activeCategories}
                      pending={edit.isPending || adjust.isPending}
                      error={edit.error ?? adjust.error}
                      onCancel={() => setEditing(null)}
                      onSave={(body) => edit.mutate({ id: recurrence.id, body })}
                      onAdjust={(amount, validFrom) =>
                        adjust.mutate({ id: recurrence.id, amount, validFrom })
                      }
                    />
                  </Collapse>

                  <Collapse open={expanded === recurrence.id}>
                    <UpcomingList recurrenceId={recurrence.id} currency={recurrence.currency} />
                  </Collapse>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EditRecurrenceForm({
  recurrence,
  categories,
  pending,
  error,
  onCancel,
  onSave,
  onAdjust,
}: {
  recurrence: Recurrence;
  categories: Category[];
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (body: Parameters<typeof updateRecurrence>[1]) => void;
  onAdjust: (amount: number, validFrom: string) => void;
}) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(recurrence.scheduleType);
  const kind = recurrence.type === 'credit' ? 'income' : 'expense';
  const eligible = categories.filter((c) => c.kind === kind);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const categoryId = String(data.get('categoryId') ?? '');
    const endsOn = String(data.get('endsOn') ?? '');

    onSave({
      description: String(data.get('description')),
      categoryId: categoryId || null,
      scheduleType,
      dayOfMonth: scheduleType === 'day_of_month' ? Number(data.get('dayOfMonth')) : null,
      adjustment: String(data.get('adjustment')) as Adjustment,
      ...(recurrence.installments === null ? { endsOn: endsOn || null } : {}),
      ...(recurrence.type === 'debit' ? { autoDebit: data.get('autoDebit') === 'on' } : {}),
    });
  }

  function handleAdjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAdjust(
      Number(String(data.get('newAmount')).replace(',', '.')),
      String(data.get('validFrom')),
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface-sunken grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Field label="Descrição">
          {(id) => (
            <Input
              id={id}
              name="description"
              required
              maxLength={255}
              defaultValue={recurrence.description}
            />
          )}
        </Field>

        <Field label="Categoria">
          {(id) => (
            <Select id={id} name="categoryId" defaultValue={recurrence.categoryId ?? ''}>
              <option value="">Sem categoria</option>
              {eligible.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Quando">
          {(id) => (
            <Select
              id={id}
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
            >
              {SCHEDULES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {scheduleType === 'day_of_month' && (
          <Field label="Dia do mês">
            {(id) => (
              <Input
                id={id}
                name="dayOfMonth"
                type="number"
                min={1}
                max={31}
                required
                defaultValue={recurrence.dayOfMonth ?? 5}
              />
            )}
          </Field>
        )}

        <Field label="Se cair no fim de semana">
          {(id) => (
            <Select id={id} name="adjustment" defaultValue={recurrence.adjustment}>
              {ADJUSTMENTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {recurrence.installments === null && (
          <Field label="Último mês" hint="Em branco = não termina.">
            {(id) => (
              <MonthField id={id} name="endsOn" defaultValue={recurrence.endsOn ?? ''} />
            )}
          </Field>
        )}

        {recurrence.type === 'debit' && (
          <label className="text-ink flex items-start gap-2.5 text-sm sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                name="autoDebit"
                className="accent-primary mt-0.5 size-4 shrink-0"
                defaultChecked={recurrence.autoDebit}
              />
              <span>
                Débito automático
                <span className="text-ink-muted mt-0.5 block text-xs">
                  Sai da conta na data, sem confirmação. Desmarcado, o gasto nasce previsto e
                  você confirma com “Dar baixa” na lista de lançamentos.
                </span>
              </span>
            </label>
        )}

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

      <form
        onSubmit={handleAdjust}
        className="border-border bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-3"
      >
        <div className="sm:col-span-3">
          <p className="text-ink text-sm font-medium">Reajustar o valor</p>
          <p className="text-ink-muted mt-0.5 text-xs">
            Vale a partir do mês escolhido. Os lançamentos anteriores ficam como estão —{' '}
            {formatMoney(recurrence.amount, recurrence.currency)} continua valendo até lá.
          </p>
        </div>

        <Field label="Novo valor">
          {(id) => <MoneyInput id={id} name="newAmount" required />}
        </Field>

        <Field label="A partir de">
          {(id) => (
            <MonthField
              id={id}
              name="validFrom"
              required
              defaultValue={new Date().toISOString().slice(0, 7)}
            />
          )}
        </Field>

        <div className="flex items-end">
          <Button type="submit" variant="secondary" disabled={pending}>
            Reajustar
          </Button>
        </div>
      </form>
    </div>
  );
}

function UpcomingList({ recurrenceId, currency }: { recurrenceId: string; currency: string }) {
  const preview = useQuery({
    queryKey: ['recurrences', recurrenceId, 'preview'],
    queryFn: () => previewRecurrence(recurrenceId),
  });

  if (preview.isPending) return <Loading label="Calculando as próximas datas…" />;
  if (preview.isError) {
    return <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />;
  }

  const occurrences = preview.data ?? [];
  if (occurrences.length === 0) {
    return (
      <p className="text-ink-muted border-border mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
        Nenhuma ocorrência à frente — esta recorrência já terminou.
      </p>
    );
  }

  return (
    <ol className="border-border mt-3 ml-1 border-l pl-4">
      {occurrences.map((occurrence) => (
        <li
          key={occurrence.competence}
          className="relative flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5"
        >
          <span
            aria-hidden="true"
            className={`absolute top-2.5 -left-5.25 size-2 rounded-full border ${
              occurrence.materialized ? 'bg-primary border-primary' : 'border-border-strong bg-surface'
            }`}
          />

          <span className="text-ink tnum text-sm">{formatDay(occurrence.occursOn)}</span>

          <span className="text-ink-muted text-xs">{formatCompetence(occurrence.competence)}</span>

          {occurrence.installment !== null && (
            <span className="text-ink-muted tnum text-xs">parcela {occurrence.installment}</span>
          )}

          {occurrence.materialized && (
            <span className="text-primary-ink text-xs font-medium">já lançado</span>
          )}

          <span className="text-ink tnum ml-auto text-sm">
            {formatMoney(occurrence.amount, currency)}
          </span>
        </li>
      ))}
    </ol>
  );
}

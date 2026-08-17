import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Amount, CategoryDot } from '@/components/money';
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
  Modal,
  SectionHeader,
  Select,
} from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import type { Category, CategoryKind } from '@/lib/resources';
import {
  archiveCategory,
  CATEGORY_KIND_LABEL,
  createCategory,
  deleteCategory,
  getCategoryUsage,
  listCategories,
} from '@/lib/resources';

const KINDS = Object.entries(CATEGORY_KIND_LABEL) as Array<[CategoryKind, string]>;

const KIND_HINT: Record<CategoryKind, string> = {
  expense: 'Consome patrimônio: alimentação, transporte, lazer.',
  income: 'Entra na carteira: salário, reembolso.',
  transfer: 'Só muda de lugar: aporte em investimento não é gasto.',
};

const UNASSIGN = 'sem-categoria';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [destination, setDestination] = useState('');

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['recurrences'] });
    void queryClient.invalidateQueries({ queryKey: ['category-usage'] });
  };

  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) =>
      archiveCategory(id, reassignToId),
    onSuccess: () => {
      setArchiving(null);
      setArchiveError(null);
      invalidate();
    },
    onError: (error) => {
      setArchiveError(error instanceof Error ? error.message : 'Erro ao arquivar.');
    },
  });

  const usage = useQuery({
    queryKey: ['category-usage', deleting?.id],
    queryFn: () => getCategoryUsage(deleting!.id),
    enabled: deleting !== null,
  });

  const remove = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string | null }) =>
      deleteCategory(id, reassignTo),
    onSuccess: () => {
      setDeleting(null);
      setDestination('');
      invalidate();
    },
  });

  const openDelete = (category: Category) => {
    remove.reset();
    setDestination('');
    setDeleting(category);
  };

  const closeDelete = () => {
    setDeleting(null);
    setDestination('');
    remove.reset();
  };

  const needsDestination =
    usage.data !== undefined && usage.data.transactionCount + usage.data.recurrenceCount > 0;

  const blocked = needsDestination && destination === '';

  const active = (categories.data ?? []).filter((c) => c.archivedAt === null);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const budget = String(data.get('monthlyBudget') ?? '').replace(',', '.');
    const parentId = String(data.get('parentId') ?? '');

    create.mutate({
      name: String(data.get('name')),
      kind,
      color: String(data.get('color')),
      ...(parentId ? { parentId } : {}),
      ...(budget ? { monthlyBudget: Number(budget) } : {}),
    });
  }

  const roots = active.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => active.filter((c) => c.parentId === id);

  return (
    <Card className="animate-rise">
      <SectionHeader
        title="Categorias"
        description="Para onde o dinheiro foi. As seis padrão vieram com a sua conta."
        action={
          <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? 'Cancelar' : 'Nova categoria'}
          </Button>
        }
      />

      <Collapse open={open}>
        <form
          onSubmit={handleCreate}
          className="border-border bg-surface-sunken mb-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Nome">
            {(id) => <Input id={id} name="name" required maxLength={80} />}
          </Field>

          <Field label="Tipo" hint={KIND_HINT[kind]}>
            {(id) => (
              <Select
                id={id}
                value={kind}
                onChange={(e) => setKind(e.target.value as CategoryKind)}
              >
                {KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Cor">
            {(id) => (
              <Input id={id} name="color" type="color" defaultValue="#00875A" className="h-10" />
            )}
          </Field>

          <Field label="Subcategoria de" hint="Um nível apenas, e do mesmo tipo.">
            {(id) => (
              <Select id={id} name="parentId" defaultValue="">
                <option value="">Nenhuma (categoria raiz)</option>
                {roots
                  .filter((c) => c.kind === kind)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>

          <Field label="Orçamento mensal" hint="Opcional. Em branco = sem orçamento definido.">
            {(id) => (
              <MoneyInput id={id} name="monthlyBudget" />
            )}
          </Field>

          {create.isError && (
            <p role="alert" className="text-negative text-sm sm:col-span-2 lg:col-span-3">
              {create.error instanceof Error ? create.error.message : 'Erro ao criar a categoria.'}
            </p>
          )}

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      </Collapse>

      {categories.isPending && <Loading />}
      {categories.isError && (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      )}

      {categories.data && active.length === 0 && (
        <Empty
          title="Nenhuma categoria ativa"
          hint="Crie uma categoria para começar a organizar seus lançamentos."
          action={<Button onClick={() => setOpen(true)}>Nova categoria</Button>}
        />
      )}

      {roots.length > 0 && (
        <ul className="divide-border divide-y">
          {roots.map((category) => (
            <li
              key={category.id}
              className="row-leave"
              data-leaving={remove.isPending && remove.variables?.id === category.id}
            >
              <div className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <CategoryDot color={category.color} kind={category.kind} />
                  <span className="text-ink text-sm font-medium">{category.name}</span>
                  <span className="text-ink-muted text-xs">
                    {CATEGORY_KIND_LABEL[category.kind]}
                    {category.isDefault && ' · padrão'}
                  </span>

                  {category.monthlyBudget !== null && (
                    <span className="text-ink-muted tnum text-xs">
                      orçamento {formatMoney(category.monthlyBudget)}/mês
                    </span>
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setArchiveError(null);
                        setArchiving(category);
                        archive.mutate({ id: category.id });
                      }}
                      disabled={archive.isPending}
                    >
                      Arquivar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => openDelete(category)}
                      disabled={remove.isPending}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>

                {childrenOf(category.id).length > 0 && (
                  <ul className="mt-2 ml-5 flex flex-col">
                    {childrenOf(category.id).map((child) => (
                      <li
                        key={child.id}
                        className="row-leave"
                        data-leaving={
                          remove.isPending &&
                          (remove.variables?.id === child.id ||
                            remove.variables?.id === category.id)
                        }
                      >
                        <div className="flex items-baseline gap-2 py-0.5">
                          <CategoryDot color={child.color} kind={child.kind} />
                          <span className="text-ink-muted min-w-0 flex-1 truncate text-sm">
                            {child.name}
                          </span>
                          <Button
                            variant="danger"
                            className="shrink-0"
                            onClick={() => openDelete(child)}
                            disabled={remove.isPending}
                          >
                            Excluir
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <Collapse open={archiving?.id === category.id && archiveError !== null}>
                  <div className="border-border bg-surface-sunken mt-3 rounded-xl border p-3">
                    <p role="alert" className="text-ink text-sm">
                      {archiveError}
                    </p>
                    <p className="text-ink-muted mt-1 text-xs">
                      Escolha para onde vão os lançamentos existentes. Precisa ser do mesmo tipo (
                      {CATEGORY_KIND_LABEL[category.kind]}).
                    </p>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="w-full sm:w-64">
                        <Field label="Realocar para">
                          {(id) => (
                            <Select
                              id={id}
                              defaultValue=""
                              onChange={(e) =>
                                e.target.value &&
                                archive.mutate({
                                  id: category.id,
                                  reassignToId: e.target.value,
                                })
                              }
                            >
                              <option value="">Escolha uma categoria</option>
                              {active
                                .filter((c) => c.kind === category.kind && c.id !== category.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </Select>
                          )}
                        </Field>
                      </div>

                      <Button
                        variant="ghost"
                        onClick={() => {
                          setArchiving(null);
                          setArchiveError(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </Collapse>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={deleting !== null}
        size="lg"
        title={deleting ? `Excluir “${deleting.name}”?` : 'Excluir categoria'}
        description={
          deleting?.parentId === null
            ? 'A categoria some da lista e dos formulários. Arquivar, ao lado, preserva o histórico — isto não.'
            : 'A subcategoria some da lista e dos formulários. Não dá para desfazer.'
        }
        locked={remove.isPending}
        onClose={closeDelete}
        footer={
          <>
            <Button variant="secondary" onClick={closeDelete} disabled={remove.isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending || usage.isPending || usage.isError || blocked}
              onClick={() =>
                deleting &&
                remove.mutate({
                  id: deleting.id,
                  reassignTo: !needsDestination
                    ? undefined
                    : destination === UNASSIGN
                      ? null
                      : destination,
                })
              }
            >
              {remove.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
            </Button>
          </>
        }
      >
        {usage.isPending && <Loading label="Verificando o que usa esta categoria…" />}
        {usage.isError && <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />}

        {usage.data && deleting && (
          <div className="flex flex-col gap-4">
            {usage.data.children.length > 0 && (
              <p className="text-ink text-sm">
                {usage.data.children.length === 1
                  ? 'A subcategoria '
                  : `As ${usage.data.children.length} subcategorias `}
                <span className="font-medium">
                  {usage.data.children.map((c) => c.name).join(', ')}
                </span>{' '}
                {usage.data.children.length === 1 ? 'será excluída' : 'serão excluídas'} junto.
              </p>
            )}

            {!needsDestination ? (
              <p className="text-ink-muted text-sm">
                Nenhum lançamento e nenhuma recorrência usam esta categoria. Pode excluir sem mexer
                em mais nada.
              </p>
            ) : (
              <>
                <p role="alert" className="text-ink text-sm">
                  <span className="text-negative font-medium">
                    {countLabel(usage.data.transactionCount, 'lançamento', 'lançamentos')}
                    {usage.data.recurrenceCount > 0 &&
                      ` e ${countLabel(usage.data.recurrenceCount, 'recorrência', 'recorrências')}`}
                  </span>{' '}
                  {usage.data.transactionCount + usage.data.recurrenceCount === 1
                    ? 'aponta'
                    : 'apontam'}{' '}
                  para ela. Escolha para onde vão antes de excluir — a exclusão não pode deixar
                  lançamento sem destino.
                </p>

                {usage.data.transactions.length > 0 && (
                  <div className="border-border bg-surface-sunken rounded-xl border">
                    <ul className="divide-border divide-y">
                      {usage.data.transactions.map((transaction) => (
                        <li
                          key={transaction.id}
                          className="flex items-baseline gap-3 px-3 py-2 text-sm"
                        >
                          <span className="text-ink-muted tnum hidden w-20 shrink-0 text-xs sm:block">
                            {formatDate(transaction.occurredAt)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-ink block truncate">
                              {transaction.description}
                            </span>
                            <span className="text-ink-muted block text-xs">
                              <span className="tnum sm:hidden">
                                {formatDate(transaction.occurredAt)} ·{' '}
                              </span>
                              {transaction.categoryName ?? 'sem categoria'}
                            </span>
                          </span>
                          <Amount
                            value={transaction.amount}
                            type={transaction.type}
                            currency={transaction.currency}
                            className="shrink-0 text-sm"
                          />
                        </li>
                      ))}
                    </ul>

                    {usage.data.transactionCount > usage.data.transactions.length && (
                      <p className="text-ink-muted border-border border-t px-3 py-2 text-xs">
                        e mais{' '}
                        {countLabel(
                          usage.data.transactionCount - usage.data.transactions.length,
                          'lançamento',
                          'lançamentos',
                        )}
                        . Todos vão para o destino escolhido abaixo.
                      </p>
                    )}
                  </div>
                )}

                {usage.data.recurrences.length > 0 && (
                  <p className="text-ink-muted text-xs">
                    Recorrências: {usage.data.recurrences.map((r) => r.description).join(', ')}.
                  </p>
                )}

                <Field
                  label="Mover tudo para"
                  hint={`Precisa ser do mesmo tipo (${CATEGORY_KIND_LABEL[deleting.kind]}).`}
                >
                  {(id) => (
                    <Select
                      id={id}
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                    >
                      <option value="">Escolha um destino</option>
                      {active
                        .filter(
                          (c) => c.kind === deleting.kind && !usage.data.categoryIds.includes(c.id),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      <option value={UNASSIGN}>Deixar sem categoria (fila de revisão)</option>
                    </Select>
                  )}
                </Field>
              </>
            )}

            {remove.isError && (
              <p role="alert" className="text-negative text-sm">
                {remove.error instanceof Error ? remove.error.message : 'Erro ao excluir.'}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

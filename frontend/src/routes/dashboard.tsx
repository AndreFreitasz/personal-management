import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AccountIcon } from "@/components/account-icon";
import {
  type BreakdownPart,
  BudgetMeter,
  CategoryBreakdown,
  ChartCard,
  CumulativeArea,
  DailyColumns,
  DataTable,
  MonthlyColumns,
  RankedBars,
  Rosette,
} from "@/components/charts";
import { Balance } from "@/components/money";
import { MoneyInput } from "@/components/money-input";
import {
  Button,
  Card,
  Collapse,
  Empty,
  ErrorState,
  FilterChip,
  Input,
  Loading,
  Segmented,
  Select,
} from "@/components/ui";
import { inCanonicalOrder, MAX_CHILDREN } from "@/lib/chart-color";
import {
  formatCompetence,
  formatDay,
  formatDayLong,
  formatMoney,
  formatPercent,
} from "@/lib/format";
import type {
  Account,
  AccountSlice,
  Category,
  CategoryChild,
  DashboardFilters,
  PeriodPreset,
  TransactionType,
} from "@/lib/resources";
import {
  ACCOUNT_TYPE_LABEL,
  getBalanceSeries,
  getByAccount,
  getByCategory,
  getDay,
  getMonthlyComparison,
  getProjection,
  getSummary,
  getTopMerchants,
  getWallet,
  listAccounts,
  listCategories,
  TRANSACTION_TYPE_LABEL,
  TRANSACTION_TYPE_SIGN,
} from "@/lib/resources";

const PERIODS = [
  { value: "this-month", label: "Este mês", short: "Mês" },
  { value: "last-month", label: "Mês passado", short: "Anterior" },
  { value: "last-3-months", label: "3 meses", short: "3m" },
  { value: "last-6-months", label: "6 meses", short: "6m" },
  { value: "last-12-months", label: "12 meses", short: "12m" },
  { value: "this-year", label: "Este ano", short: "Ano" },
] as const satisfies ReadonlyArray<{
  value: PeriodPreset;
  label: string;
  short: string;
}>;

const CATEGORY_MODES = [
  { value: "include", label: "Somente estas" },
  { value: "exclude", label: "Todas menos estas" },
] as const;

type CategoryMode = (typeof CATEGORY_MODES)[number]["value"];

const TYPES = Object.entries(TRANSACTION_TYPE_LABEL) as Array<
  [TransactionType, string]
>;

const MAX_SLICES = 6;

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const period = (params.get("period") as PeriodPreset | null) ?? "this-month";
  const accountId = params.getAll("accountId");
  const categoryId = params.getAll("categoryId");
  const excludeCategoryId = params.getAll("excludeCategoryId");
  const search = params.get("search") ?? "";
  const type = params.getAll("type") as TransactionType[];
  const minAmount = params.get("minAmount") ?? "";
  const maxAmount = params.get("maxAmount") ?? "";
  const categoryMode: CategoryMode = excludeCategoryId.length
    ? "exclude"
    : "include";

  const filters: DashboardFilters = useMemo(
    () => ({
      period,
      ...(accountId.length ? { accountId } : {}),
      ...(categoryId.length ? { categoryId } : {}),
      ...(excludeCategoryId.length ? { excludeCategoryId } : {}),
      ...(search ? { search } : {}),
      ...(type.length ? { type } : {}),
      ...(minAmount ? { minAmount: Number(minAmount) } : {}),
      ...(maxAmount ? { maxAmount: Number(maxAmount) } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString()],
  );

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  }

  function toggle(key: string, value: string) {
    update((next) => {
      const current = next.getAll(key);
      next.delete(key);
      for (const item of current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]) {
        next.append(key, item);
      }
    });
  }

  const [draft, setDraft] = useDebounced(search, (value) =>
    update((next) =>
      value ? next.set("search", value) : next.delete("search"),
    ),
  );

  const key = ["dashboard", filters] as const;
  const options = { placeholderData: keepPreviousData };

  const summary = useQuery({
    queryKey: [...key, "summary"],
    queryFn: () => getSummary(filters),
    ...options,
  });
  const byCategory = useQuery({
    queryKey: [...key, "by-category"],
    queryFn: () => getByCategory(filters),
    ...options,
  });
  const series = useQuery({
    queryKey: [...key, "series"],
    queryFn: () => getBalanceSeries(filters),
    ...options,
  });
  const monthly = useQuery({
    queryKey: [...key, "monthly"],
    queryFn: () => getMonthlyComparison(filters),
    ...options,
  });
  const merchants = useQuery({
    queryKey: [...key, "merchants"],
    queryFn: () => getTopMerchants(filters),
    ...options,
  });
  const byAccount = useQuery({
    queryKey: [...key, "by-account"],
    queryFn: () => getByAccount(filters),
    ...options,
  });
  const projection = useQuery({
    queryKey: [...key, "projection"],
    queryFn: () => getProjection(filters),
    ...options,
  });

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const activeFilters =
    accountId.length +
    categoryId.length +
    excludeCategoryId.length +
    type.length +
    (search ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-ink text-2xl font-semibold tracking-tight">
            Painel
          </h1>
          <p className="text-ink-muted mt-0.5 text-sm">
            {summary.data
              ? `Realizado de ${formatDay(summary.data.period.from.slice(0, 10))} a ${formatDay(summary.data.period.to.slice(0, 10))}.`
              : "Para onde foi o dinheiro, e como o mês termina."}
          </p>
        </div>
      </header>

      <Card className="p-4!">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={PERIODS}
            value={period}
            onChange={(next) =>
              update((params) => {
                params.set("period", next);
                params.delete("from");
                params.delete("to");
              })
            }
            label="Período"
          />

          <div className="flex min-w-45 flex-1 items-center gap-2">
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Buscar na descrição"
              aria-label="Buscar na descrição"
            />
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              Filtros
              {activeFilters > 0 && (
                <span className="bg-primary text-on-primary tnum grid size-5 place-items-center rounded-full text-[11px]">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>
        </div>

        <Collapse open={showFilters}>
          <div className="border-border mt-4 space-y-4 border-t pt-4">
            <Chips
              label="Contas"
              empty="Nenhuma conta cadastrada."
              items={(accounts.data ?? []).filter(
                (account) => !account.archivedAt,
              )}
              selected={accountId}
              onToggle={(id) => toggle("accountId", id)}
              render={(account: Account) => (
                <>
                  <AccountIcon
                    icon={account.icon}
                    name={account.name}
                    size="sm"
                  />
                  {account.name}
                </>
              )}
            />

            <div>
              <p className="text-ink text-sm font-medium">Tipo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPES.map(([value, label]) => {
                  const on = type.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle("type", value)}
                      className={`tap rounded-full border px-3 py-1.5 text-xs font-medium ${
                        on
                          ? "border-primary bg-primary-soft text-primary-ink"
                          : "border-border text-ink-muted hover:border-primary hover:text-primary-ink"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-ink text-sm font-medium">Faixa de valor</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="max-w-36">
                  <MoneyInput
                    defaultValue={minAmount}
                    onCommit={(value) =>
                      update((next) =>
                        value
                          ? next.set("minAmount", value)
                          : next.delete("minAmount"),
                      )
                    }
                    placeholder="Mínimo"
                    aria-label="Valor mínimo"
                  />
                </div>
                <span className="text-ink-muted text-sm">até</span>
                <div className="max-w-36">
                  <MoneyInput
                    defaultValue={maxAmount}
                    onCommit={(value) =>
                      update((next) =>
                        value
                          ? next.set("maxAmount", value)
                          : next.delete("maxAmount"),
                      )
                    }
                    placeholder="Máximo"
                    aria-label="Valor máximo"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink text-sm font-medium">Categorias</p>
                <Segmented
                  options={CATEGORY_MODES}
                  value={categoryMode}
                  onChange={(mode) =>
                    update((next) => {
                      const chosen = [
                        ...next.getAll("categoryId"),
                        ...next.getAll("excludeCategoryId"),
                      ];
                      next.delete("categoryId");
                      next.delete("excludeCategoryId");
                      for (const id of chosen) {
                        next.append(
                          mode === "exclude"
                            ? "excludeCategoryId"
                            : "categoryId",
                          id,
                        );
                      }
                    })
                  }
                  label="Como aplicar as categorias"
                />
              </div>
              <Chips
                items={(categories.data ?? []).filter(
                  (category) => !category.archivedAt,
                )}
                selected={
                  categoryMode === "exclude" ? excludeCategoryId : categoryId
                }
                onToggle={(id) =>
                  toggle(
                    categoryMode === "exclude"
                      ? "excludeCategoryId"
                      : "categoryId",
                    id,
                  )
                }
                empty="Nenhuma categoria."
                render={(category: Category) => (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor:
                          category.color ?? "var(--color-ink-muted)",
                      }}
                    />
                    {category.name}
                  </>
                )}
              />
            </div>
          </div>
        </Collapse>

        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {search && (
              <FilterChip
                onRemove={() => update((next) => next.delete("search"))}
                removeLabel="Remover busca"
              >
                “{search}”
              </FilterChip>
            )}
            {type.map((value) => (
              <FilterChip
                key={value}
                onRemove={() => toggle("type", value)}
                removeLabel={`Remover tipo ${TRANSACTION_TYPE_LABEL[value]}`}
              >
                {TRANSACTION_TYPE_LABEL[value]}
              </FilterChip>
            ))}
            {(minAmount || maxAmount) && (
              <FilterChip
                onRemove={() =>
                  update((next) => {
                    next.delete("minAmount");
                    next.delete("maxAmount");
                  })
                }
                removeLabel="Remover faixa de valor"
              >
                {minAmount ? formatMoney(Number(minAmount)) : "qualquer"} até{" "}
                {maxAmount ? formatMoney(Number(maxAmount)) : "qualquer"}
              </FilterChip>
            )}
            {accountId.map((id) => (
              <FilterChip
                key={id}
                onRemove={() => toggle("accountId", id)}
                removeLabel={`Remover conta ${nameOf(accounts.data, id)}`}
              >
                <AccountIcon
                  icon={accounts.data?.find((item) => item.id === id)?.icon}
                  name={nameOf(accounts.data, id)}
                  size="sm"
                />
                {nameOf(accounts.data, id)}
              </FilterChip>
            ))}
            {[...categoryId, ...excludeCategoryId].map((id) => (
              <FilterChip
                key={id}
                onRemove={() =>
                  toggle(
                    categoryMode === "exclude"
                      ? "excludeCategoryId"
                      : "categoryId",
                    id,
                  )
                }
                removeLabel={`Remover categoria ${nameOf(categories.data, id)}`}
              >
                {categoryMode === "exclude" && (
                  <span className="text-ink-muted">sem</span>
                )}
                {nameOf(categories.data, id)}
              </FilterChip>
            ))}
            <button
              type="button"
              onClick={() =>
                setParams(
                  new URLSearchParams(
                    period === "this-month" ? {} : { period },
                  ),
                  {
                    replace: true,
                  },
                )
              }
              className="tap link-ios text-primary-ink text-xs font-medium underline underline-offset-2"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </Card>

      {summary.isError ? (
        <ErrorState
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      ) : summary.data ? (
        <KpiRow
          summary={summary.data}
          projection={projection.data}
          wallet={wallet.data}
          busy={summary.isFetching}
        />
      ) : (
        <Card>
          <Loading label="Somando o período…" />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CategoryCard query={byCategory} style={{ animationDelay: "60ms" }} />
        <BudgetCard query={byCategory} style={{ animationDelay: "120ms" }} />
      </div>

      <ChartCard
        title="Mês a mês"
        description="Entradas acima da linha, saídas abaixo. Agrupado por competência."
        busy={monthly.isFetching}
        style={{ animationDelay: "180ms" }}
        table={
          <DataTable
            columns={["Mês", "Entradas", "Saídas", "Resultado"]}
            rows={(monthly.data?.months ?? []).map((month) => ({
              key: month.competence,
              cells: [
                formatCompetence(month.competence),
                formatMoney(month.income),
                formatMoney(month.expense),
                formatMoney(month.net),
              ],
            }))}
          />
        }
      >
        {monthly.isError ? (
          <ErrorState
            error={monthly.error}
            onRetry={() => void monthly.refetch()}
          />
        ) : monthly.data ? (
          <MonthlyColumns months={monthly.data.months} />
        ) : (
          <Loading />
        )}
      </ChartCard>

      <DailyCard
        series={series}
        monthly={monthly}
        filters={filters}
        style={{ animationDelay: "210ms" }}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <AccountsCard
          query={byAccount}
          selected={accountId}
          onToggle={(id) => toggle("accountId", id)}
          style={{ animationDelay: "240ms" }}
        />

        <ChartCard
          title="Onde o dinheiro foi parar"
          description="As maiores saídas do período, pela descrição."
          busy={merchants.isFetching}
          style={{ animationDelay: "240ms" }}
          table={
            <DataTable
              columns={["Descrição", "Total", "Lançamentos"]}
              rows={(merchants.data?.merchants ?? []).map((merchant) => ({
                key: merchant.description,
                cells: [
                  merchant.description,
                  formatMoney(merchant.total),
                  merchant.count,
                ],
              }))}
            />
          }
        >
          {merchants.isError ? (
            <ErrorState
              error={merchants.error}
              onRetry={() => void merchants.refetch()}
            />
          ) : !merchants.data ? (
            <Loading />
          ) : merchants.data.merchants.length === 0 ? (
            <Empty
              title="Nenhuma saída no período"
              hint="As descrições que mais consumiram o mês aparecem aqui, da maior para a menor."
            />
          ) : (
            <RankedBars
              items={merchants.data.merchants.map((merchant) => ({
                key: merchant.description,
                label: merchant.description,
                value: merchant.total,
                hint: merchant.count > 1 ? `${merchant.count}×` : undefined,
              }))}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Acumulado no período"
        description="Quanto o recorte somou, dia a dia, começando do zero."
        busy={series.isFetching}
        style={{ animationDelay: "300ms" }}
        table={
          <DataTable
            columns={["Dia", "No dia", "Acumulado"]}
            rows={(series.data?.points ?? [])
              .filter((point) => point.net !== 0)
              .map((point) => ({
                key: point.date,
                cells: [
                  formatDay(point.date),
                  formatMoney(point.net),
                  formatMoney(point.cumulative),
                ],
              }))}
          />
        }
      >
        {series.isError ? (
          <ErrorState error={series.error} onRetry={() => void series.refetch()} />
        ) : series.data && series.data.points.some((point) => point.net !== 0) ? (
          <CumulativeArea points={series.data.points} />
        ) : series.data ? (
          <Empty
            title="Nenhum lançamento neste recorte"
            hint="Troque o período ou tire um filtro para ver o acumulado."
          />
        ) : (
          <Loading />
        )}
      </ChartCard>
    </div>
  );
}

function KpiRow({
  summary,
  projection,
  wallet,
  busy,
}: {
  summary: NonNullable<
    ReturnType<typeof useQuery<Awaited<ReturnType<typeof getSummary>>>>["data"]
  >;
  projection?: Awaited<ReturnType<typeof getProjection>>;
  wallet?: Awaited<ReturnType<typeof getWallet>>;
  busy: boolean;
}) {
  const delta =
    summary.previous.net === 0
      ? null
      : (summary.net - summary.previous.net) / Math.abs(summary.previous.net);

  const active =
    wallet?.accounts.filter((account) => account.archivedAt === null).length ??
    0;

  return (
    <div
      className="filtering grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      data-busy={busy}
    >
      <Card className="animate-rise flex flex-col justify-between gap-4">
        <div>
          <p className="text-ink-muted font-serial text-[11px] tracking-wider uppercase">
            Saldo em conta
          </p>
          <p className="font-display mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
            {wallet ? <Balance value={wallet.balance} /> : "—"}
          </p>
          <p className="text-ink-muted mt-2 text-sm">
            {active > 0
              ? `Soma de ${active === 1 ? "1 conta ativa" : `${active} contas ativas`}`
              : "Cadastre uma conta na Carteira para o saldo começar a existir."}
          </p>
        </div>

        <div className="border-border border-t pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-ink text-sm font-medium">Resultado do período</p>
            <p className="text-xl font-semibold">
              <Balance value={summary.net} signed />
            </p>
          </div>

          <div className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {delta !== null && (
              <span className={delta >= 0 ? "text-positive" : "text-negative"}>
                <span aria-hidden="true">{delta >= 0 ? "↑" : "↓"}</span>{" "}
                {formatPercent(Math.abs(delta))}
                <span className="text-ink-muted"> vs. período anterior</span>
              </span>
            )}
            {summary.savingsRate !== null && (
              <span>
                Taxa de poupança{" "}
                <strong className="text-ink font-medium">
                  {formatPercent(summary.savingsRate)}
                </strong>
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Entradas" value={summary.income} tone="positive" />
            <Stat label="Saídas" value={summary.expense} tone="negative" />
          </div>
        </div>
      </Card>

      <Card
        className="animate-rise flex flex-col justify-between gap-4"
        style={{ animationDelay: "80ms" }}
      >
        <div>
          <p className="text-ink-muted font-serial text-[11px] tracking-wider uppercase">
            Projeção do fim do mês
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {projection ? <Balance value={projection.projected} /> : "—"}
          </p>
          <p className="text-ink-muted mt-2 text-sm">
            {projection
              ? `Saldo de hoje ${formatMoney(projection.balance)} somado ao que já está agendado.`
              : "Calculando…"}
          </p>
        </div>

        {projection && (
          <dl className="border-border grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <dt className="text-ink-muted">A receber</dt>
              <dd className="text-positive tnum mt-0.5 font-medium">
                +{formatMoney(projection.scheduledIncome)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">A pagar</dt>
              <dd className="text-negative tnum mt-0.5 font-medium">
                −{formatMoney(projection.scheduledExpense)}
              </dd>
            </div>
          </dl>
        )}

        <p className="text-ink-muted text-xs">
          Sempre até o fim do mês corrente — independe do período escolhido.
        </p>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-ink-muted text-sm">{label}</p>
      <p
        className={`tnum mt-0.5 text-lg font-semibold ${tone === "positive" ? "text-positive" : "text-negative"}`}
      >
        <span aria-hidden="true">{tone === "positive" ? "+" : "−"}</span>
        {formatMoney(value)}
      </p>
    </div>
  );
}

const NO_SUBCATEGORY = "Nenhuma subcategoria";

function toParts(children: CategoryChild[]): BreakdownPart[] {
  const ranked = [...children].sort((a, b) => b.total - a.total);
  const overflow = ranked.length > MAX_CHILDREN;
  const named = overflow ? ranked.slice(0, MAX_CHILDREN - 1) : ranked;
  const rest = overflow ? ranked.slice(MAX_CHILDREN - 1) : [];

  const parts: BreakdownPart[] = named.map((child) => ({
    key: child.categoryId ?? "sem-subcategoria",
    categoryId: child.categoryId,
    name: child.name ?? NO_SUBCATEGORY,
    total: child.total,
    share: child.share,
    count: child.count,
  }));

  if (rest.length) {
    parts.push({
      key: "outras-subcategorias",
      categoryId: "overflow",
      name: `Outras (${rest.length})`,
      total: rest.reduce((sum, child) => sum + child.total, 0),
      share: rest.reduce((sum, child) => sum + child.share, 0),
      count: rest.reduce((sum, child) => sum + child.count, 0),
    });
  }

  return parts;
}

function CategoryCard({
  query,
  style,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getByCategory>>>>;
  style?: React.CSSProperties;
}) {
  const data = query.data;
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const slices = useMemo(() => {
    if (!data) return [];
    const ranked = [...data.slices].sort((a, b) => b.total - a.total);
    const named = ranked.slice(0, MAX_SLICES);
    const rest = ranked.slice(MAX_SLICES);

    const merged = rest.length
      ? [
          ...named,
          {
            categoryId: null,
            name: `Outras (${rest.length})`,
            color: null,
            kind: null,
            total: rest.reduce((sum, slice) => sum + slice.total, 0),
            share: rest.reduce((sum, slice) => sum + slice.share, 0),
            count: rest.reduce((sum, slice) => sum + slice.count, 0),
            budget: null,
            children: rest.map((slice) => ({
              categoryId: slice.categoryId,
              name: slice.name,
              color: slice.color,
              total: slice.total,
              share: 0,
              count: slice.count,
            })),
          },
        ]
      : named;

    return inCanonicalOrder(merged).map((slice) => {
      const parts = toParts(slice.children);
      return {
        key: slice.categoryId ?? slice.name,
        name: slice.name,
        color: slice.color,
        total: slice.total,
        share: slice.share,
        count: slice.count,
        rootless: slice.categoryId === null && slice.name === "Sem categoria",
        parts: parts.map((part) => ({
          ...part,
          share: slice.total > 0 ? part.total / slice.total : 0,
        })),
      };
    });
  }, [data]);

  const shown = slices.find((slice) => slice.key === closing);

  function reveal(key: string | null) {
    if (key) setClosing(key);
    setOpen(key);
  }

  return (
    <ChartCard
      title="Para onde foi o dinheiro"
      description="Saídas do período, por categoria. Toque numa fatia para abrir as subcategorias."
      busy={query.isFetching}
      style={style}
      table={
        <DataTable
          columns={["Categoria", "Total", "Parte", "Lançamentos"]}
          rows={(data?.slices ?? []).flatMap((slice) => {
            const row = {
              key: slice.categoryId ?? slice.name,
              cells: [
                slice.name,
                formatMoney(slice.total),
                formatPercent(slice.share),
                slice.count,
              ],
            };

            const named = slice.children.filter((child) => child.categoryId !== null);
            if (named.length === 0) return [row];

            return [
              row,
              ...slice.children.map((child) => ({
                key: `${slice.categoryId ?? slice.name}:${child.categoryId ?? "solto"}`,
                cells: [
                  `${slice.name} › ${child.name ?? NO_SUBCATEGORY}`,
                  formatMoney(child.total),
                  formatPercent(child.share),
                  child.count,
                ],
              })),
            ];
          })}
        />
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !data ? (
        <Loading />
      ) : slices.length === 0 ? (
        <Empty
          title="Nenhuma saída no período"
          hint="Quando houver gastos neste recorte, eles aparecem aqui repartidos por categoria."
        />
      ) : (
        <>
          <Rosette
            slices={slices}
            total={data.total}
            selected={open}
            onSelect={reveal}
          />

          <Collapse open={open !== null}>
            {shown && (
              <CategoryBreakdown
                key={shown.key}
                name={shown.name}
                color={shown.color}
                total={shown.total}
                count={shown.count}
                share={shown.share}
                parts={shown.parts}
                rootless={shown.rootless}
                onClose={() => reveal(null)}
              />
            )}
          </Collapse>
        </>
      )}
    </ChartCard>
  );
}

function DailyCard({
  series,
  monthly,
  filters,
  style,
}: {
  series: ReturnType<
    typeof useQuery<Awaited<ReturnType<typeof getBalanceSeries>>>
  >;
  monthly: ReturnType<
    typeof useQuery<Awaited<ReturnType<typeof getMonthlyComparison>>>
  >;
  filters: DashboardFilters;
  style?: React.CSSProperties;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const months = monthly.data?.months ?? [];

  const fallback =
    [...months].reverse().find((month) => month.income > 0 || month.expense > 0) ??
    months[months.length - 1];
  const chosen =
    months.find((month) => month.competence === picked) ?? fallback;

  const prefix = chosen?.competence.slice(0, 7);
  const days = (series.data?.points ?? []).filter((point) =>
    prefix ? point.date.startsWith(prefix) : false,
  );

  const shown = openDay && days.some((day) => day.date === openDay) ? openDay : null;

  function open(date: string | null) {
    if (date) setClosing(date);
    setOpenDay(date);
  }

  return (
    <ChartCard
      title="Dia a dia"
      description={
        chosen
          ? `Cada dia de ${formatCompetence(chosen.competence)}. Fim de semana em faixa mais escura.`
          : "Cada dia do mês, entradas acima da linha e saídas abaixo."
      }
      busy={series.isFetching || monthly.isFetching}
      style={style}
      action={
        months.length > 1 && (
          <Select
            aria-label="Mês do detalhamento diário"
            value={chosen?.competence ?? ""}
            onChange={(event) => setPicked(event.target.value)}
            className="max-w-40"
          >
            {months.map((month) => (
              <option key={month.competence} value={month.competence}>
                {formatCompetence(month.competence)}
              </option>
            ))}
          </Select>
        )
      }
      table={
        <DataTable
          columns={["Dia", "Entradas", "Saídas", "Resultado"]}
          rows={days
            .filter((day) => day.income > 0 || day.expense > 0)
            .map((day) => ({
              key: day.date,
              cells: [
                formatDay(day.date),
                formatMoney(day.income),
                formatMoney(day.expense),
                formatMoney(day.net),
              ],
            }))}
        />
      }
    >
      {series.isError ? (
        <ErrorState error={series.error} onRetry={() => void series.refetch()} />
      ) : !series.data || !chosen ? (
        <Loading />
      ) : days.every((day) => day.income === 0 && day.expense === 0) ? (
        <Empty
          title={`Nenhum lançamento em ${formatCompetence(chosen.competence)}`}
          hint="Troque o mês acima, o período ou tire um filtro."
        />
      ) : (
        <>
          <DailyColumns days={days} selected={shown} onSelect={open} />

          <Collapse open={shown !== null}>
            {closing && (
              <DayPanel
                date={closing}
                filters={filters}
                onClose={() => open(null)}
              />
            )}
          </Collapse>

          <dl className="border-border mt-4 grid grid-cols-2 gap-4 border-t pt-3 text-sm">
            <div>
              <dt className="text-ink-muted">Entradas no mês</dt>
              <dd className="text-positive tnum mt-0.5 font-medium">
                +{formatMoney(chosen.income)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Saídas no mês</dt>
              <dd className="text-negative tnum mt-0.5 font-medium">
                −{formatMoney(chosen.expense)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </ChartCard>
  );
}

function DayPanel({
  date,
  filters,
  onClose,
}: {
  date: string;
  filters: DashboardFilters;
  onClose: () => void;
}) {
  const day = useQuery({
    queryKey: ["dashboard", filters, "day", date],
    queryFn: () => getDay(filters, date),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="border-border bg-surface-sunken mt-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-ink text-sm font-semibold">
            {formatDayLong(date)}
          </h3>
          <p className="text-ink-muted mt-0.5 text-xs">
            {day.data
              ? day.data.count === 0
                ? "Nenhum lançamento neste recorte."
                : `${day.data.count} ${day.data.count === 1 ? "lançamento" : "lançamentos"} no dia`
              : "Buscando os lançamentos do dia…"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {day.data && (
            <dl className="flex items-baseline gap-3 text-xs">
              <div className="flex items-baseline gap-1">
                <dt className="text-ink-muted">Entradas</dt>
                <dd className="text-positive tnum font-medium">
                  +{formatMoney(day.data.income)}
                </dd>
              </div>
              <div className="flex items-baseline gap-1">
                <dt className="text-ink-muted">Saídas</dt>
                <dd className="text-negative tnum font-medium">
                  −{formatMoney(day.data.expense)}
                </dd>
              </div>
            </dl>
          )}
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      <div className="filtering mt-3" data-busy={day.isFetching}>
        {day.isError ? (
          <ErrorState error={day.error} onRetry={() => void day.refetch()} />
        ) : !day.data ? (
          <Loading label="Buscando os lançamentos do dia…" />
        ) : day.data.transactions.length === 0 ? (
          <p className="text-ink-muted text-sm">
            A coluna deste dia está zerada porque nada neste recorte aconteceu
            nele.
          </p>
        ) : (
          <>
            <ul className="divide-border divide-y">
              {day.data.transactions.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 py-2 sm:items-center"
                >
                  <AccountIcon
                    icon={entry.accountIcon}
                    name={entry.accountName}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm">
                      {entry.description}
                    </p>
                    <p className="text-ink-muted flex items-center gap-1.5 truncate text-xs">
                      {entry.categoryName && (
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              entry.categoryColor ?? "var(--color-ink-muted)",
                          }}
                        />
                      )}
                      {entry.categoryName ?? "Sem categoria"} ·{" "}
                      {entry.accountName}
                    </p>
                  </div>

                  <p
                    className={`tnum shrink-0 text-sm font-medium ${
                      entry.type === "credit"
                        ? "text-positive"
                        : entry.type === "debit"
                          ? "text-negative"
                          : "text-ink-muted"
                    }`}
                  >
                    <span aria-hidden="true">
                      {TRANSACTION_TYPE_SIGN[entry.type]}
                    </span>
                    {formatMoney(entry.amount, entry.currency)}
                  </p>
                </li>
              ))}
            </ul>

            {day.data.count > day.data.transactions.length && (
              <p className="text-ink-muted mt-2 text-xs">
                E mais {day.data.count - day.data.transactions.length} neste
                dia. A lista completa está em Lançamentos.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const ACCOUNT_SCOPES = [
  { value: "all", label: "Todas" },
  { value: "cards", label: "Só cartões" },
] as const;

type AccountScope = (typeof ACCOUNT_SCOPES)[number]["value"];

function AccountsCard({
  query,
  selected,
  onToggle,
  style,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getByAccount>>>>;
  selected: string[];
  onToggle: (id: string) => void;
  style?: React.CSSProperties;
}) {
  const [scope, setScope] = useState<AccountScope>("all");

  const all = query.data?.accounts ?? [];
  const visible =
    scope === "cards"
      ? all.filter((account) => account.type === "credit_card")
      : all;

  const item = (account: AccountSlice) => ({
    key: account.accountId,
    label: account.name,
    value: account.expense,
    sub: `${ACCOUNT_TYPE_LABEL[account.type]}${account.archived ? " · arquivada" : ""}`,
    hint: account.count > 0 ? `${account.count}×` : undefined,
    leading: (
      <AccountIcon icon={account.icon} name={account.name} size="md" />
    ),
  });

  return (
    <ChartCard
      title="Onde está saindo mais"
      description="Saídas do período por conta e cartão. Toque numa linha para filtrar o painel por ela."
      busy={query.isFetching}
      style={style}
      action={
        <Segmented
          options={ACCOUNT_SCOPES}
          value={scope}
          onChange={setScope}
          label="Quais contas mostrar"
        />
      }
      table={
        <DataTable
          columns={["Conta", "Tipo", "Saídas", "Parte", "Saídas no período"]}
          rows={visible.map((account) => ({
            key: account.accountId,
            cells: [
              account.name,
              ACCOUNT_TYPE_LABEL[account.type],
              formatMoney(account.expense),
              formatPercent(account.share),
              account.count,
            ],
          }))}
        />
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty
          title={
            scope === "cards"
              ? "Nenhum cartão de crédito cadastrado"
              : "Nenhuma conta cadastrada"
          }
          hint="Cadastre a conta na Carteira, com o tipo certo, e ela entra neste comparativo."
        />
      ) : visible.every((account) => account.expense === 0) ? (
        <Empty
          title={
            scope === "cards"
              ? "Nenhum gasto no cartão neste período"
              : "Nenhuma saída no período"
          }
          hint="Quando houver gastos neste recorte, eles aparecem repartidos por conta, do maior para o menor."
        />
      ) : (
        <RankedBars
          items={visible.map(item)}
          onSelect={onToggle}
          selected={selected}
          selectHint={(entry, on) =>
            `${entry.label}, ${formatMoney(entry.value)} em saídas. ${
              on ? "Tocar para tirar o filtro." : "Tocar para filtrar o painel por ela."
            }`
          }
        />
      )}
    </ChartCard>
  );
}

function BudgetCard({
  query,
  style,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getByCategory>>>>;
  style?: React.CSSProperties;
}) {
  const withBudget = (query.data?.slices ?? []).filter(
    (slice): slice is typeof slice & { budget: number } =>
      slice.budget !== null && slice.budget > 0,
  );

  return (
    <ChartCard
      title="Orçado × realizado"
      description="Só as categorias com orçamento definido."
      busy={query.isFetching}
      style={style}
      table={
        <DataTable
          columns={["Categoria", "Gasto", "Orçado", "Uso"]}
          rows={withBudget.map((slice) => ({
            key: slice.categoryId ?? slice.name,
            cells: [
              slice.name,
              formatMoney(slice.total),
              formatMoney(slice.budget),
              formatPercent(slice.total / slice.budget),
            ],
          }))}
        />
      }
    >
      {withBudget.length === 0 ? (
        <Empty
          title="Nenhum orçamento definido"
          hint="Defina um teto mensal em Categorias e ele aparece aqui, comparado com o gasto do período."
        />
      ) : (
        <ul className="space-y-4">
          {withBudget.map((slice) => (
            <BudgetMeter
              key={slice.categoryId ?? slice.name}
              name={slice.name}
              color={slice.color}
              spent={slice.total}
              budget={slice.budget}
            />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

function Chips<T extends { id: string }>({
  label,
  items,
  selected,
  onToggle,
  render,
  empty,
}: {
  label?: string;
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  render: (item: T) => React.ReactNode;
  empty: string;
}) {
  return (
    <div>
      {label && <p className="text-ink text-sm font-medium">{label}</p>}
      {items.length === 0 ? (
        <p className="text-ink-muted mt-1 text-sm">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => {
            const on = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(item.id)}
                className={`tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  on
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-border text-ink-muted hover:border-primary hover:text-primary-ink"
                }`}
              >
                {render(item)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function nameOf(
  items: Array<{ id: string; name: string }> | undefined,
  id: string,
): string {
  return items?.find((item) => item.id === id)?.name ?? "item";
}

function useDebounced(
  urlValue: string,
  commit: (next: string) => void,
  delay = 350,
) {
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

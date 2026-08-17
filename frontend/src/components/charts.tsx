import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { chartInk, chartInkRamp } from '@/lib/chart-color';
import {
  formatCompact,
  formatCompetence,
  formatDayLong,
  formatMoney,
  formatPercent,
} from '@/lib/format';
import { useTheme } from '@/lib/theme';

function useIsDark(): boolean {
  const preference = useTheme();

  const system = useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => false,
  );

  return preference === 'system' ? system : preference === 'dark';
}

function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => setWidth(node.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return drawn;
}

interface TipState {
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}

function Tip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;

  const clamped = Math.min(Math.max(tip.x, 84), Math.max(width - 84, 84));

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border bg-surface shadow-card pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 -translate-y-full rounded-xl border p-2.5"
      style={{ left: clamped, top: Math.max(tip.y - 12, 8) }}
    >
      <p className="text-ink-muted font-serial text-[11px] tracking-wide uppercase">{tip.title}</p>
      <ul className="mt-1.5 space-y-1">
        {tip.rows.map((row) => (
          <li key={row.label} className="flex items-baseline gap-2">
            {row.color && (
              <span
                aria-hidden="true"
                className="mt-1 inline-block h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="text-ink tnum text-sm font-semibold">{row.value}</span>
            <span className="text-ink-muted truncate text-xs">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  busy = false,
  action,
  table,
  children,
  className = '',
  style,
}: {
  title: string;
  description?: string;
  busy?: boolean;
  action?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      style={style}
      className={`border-border bg-surface shadow-card animate-rise rounded-2xl border p-5 sm:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-ink text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-ink-muted mt-0.5 text-sm">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
            className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink rounded-lg px-2.5 py-1.5 text-xs font-medium"
          >
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>
      </div>

      <div className="filtering" data-busy={busy}>
        {showTable ? <div className="overflow-x-auto">{table}</div> : children}
      </div>
    </section>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border border-b">
          {columns.map((column, index) => (
            <th
              key={column}
              scope="col"
              className={`text-ink-muted py-2 font-serial text-[11px] font-normal tracking-wide uppercase ${
                index === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-border/60 border-b last:border-0">
            {row.cells.map((cell, index) => (
              <td
                key={index}
                className={`text-ink py-2 ${index === 0 ? 'text-left' : 'tnum text-right'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface Slice {
  key: string;
  name: string;
  color: string | null;
  total: number;
  share: number;
}

export function Rosette({
  slices,
  total,
  currency = 'BRL',
  selected = null,
  onSelect,
}: {
  slices: Slice[];
  total: number;
  currency?: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const dark = useIsDark();
  const drawn = useDrawn();
  const [active, setActive] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [ref, width] = useMeasure<HTMLDivElement>();

  const size = Math.min(Math.max(width, 200), 260);
  const center = size / 2;
  const thickness = size < 230 ? 18 : 22;
  const radius = center - thickness / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const length = Math.max(circumference * slice.share - gap, 0.5);
    const arc = { slice, length, offset: cursor };
    cursor += circumference * slice.share;
    return arc;
  });

  const openSlice = slices.find((slice) => slice.key === selected);
  const activeSlice = slices.find((slice) => slice.key === active) ?? openSlice;
  const dimmed = selected !== null;

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Gastos por categoria, total de ${formatMoney(total, currency)}`}
          className="shrink-0 overflow-visible"
          style={{
            transform: drawn ? 'none' : 'scale(0.94)',
            opacity: drawn ? 1 : 0,
            transition: `transform var(--motion-settle) var(--ease-ios-spring), opacity var(--motion-tint) var(--ease-ios)`,
          }}
        >
          <g aria-hidden="true" className="text-border">
            <circle
              cx={center}
              cy={center}
              r={radius - thickness / 2 - 5}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            />
            <circle
              cx={center}
              cy={center}
              r={radius - thickness / 2 - 9}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
          </g>

          <g transform={`rotate(-90 ${center} ${center})`}>
            {arcs.map(({ slice, length, offset }) => {
              const ink = chartInk(slice.color, dark);
              const isActive = active === slice.key;
              const isOpen = selected === slice.key;

              return (
                <circle
                  key={slice.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ink}
                  strokeWidth={
                    isOpen ? thickness + 6 : isActive ? thickness + 5 : dimmed ? 4 : thickness
                  }
                  strokeDasharray={`${drawn ? length : 0} ${circumference}`}
                  strokeDashoffset={-offset}
                  opacity={dimmed && !isOpen && !isActive ? 0.45 : 1}
                  tabIndex={0}
                  role="button"
                  aria-pressed={onSelect ? isOpen : undefined}
                  aria-label={`${slice.name}: ${formatMoney(slice.total, currency)}, ${formatPercent(slice.share)} do total.${
                    onSelect
                      ? isOpen
                        ? ' Fechar a quebra por subcategoria.'
                        : ' Abrir a quebra por subcategoria.'
                      : ''
                  }`}
                  className="cursor-pointer outline-offset-4"
                  style={{
                    transition:
                      'stroke-dasharray var(--motion-settle) var(--ease-ios), stroke-width var(--motion-tint) var(--ease-ios), opacity var(--motion-tint) var(--ease-ios)',
                  }}
                  onClick={onSelect ? () => onSelect(isOpen ? null : slice.key) : undefined}
                  onKeyDown={
                    onSelect
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          onSelect(isOpen ? null : slice.key);
                        }
                      : undefined
                  }
                  onPointerEnter={(event) => {
                    setActive(slice.key);
                    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    setTip({
                      x: box ? event.clientX - box.left : center,
                      y: box ? event.clientY - box.top : center,
                      title: slice.name,
                      rows: [
                        {
                          label: formatPercent(slice.share),
                          value: formatMoney(slice.total, currency),
                          color: ink,
                        },
                      ],
                    });
                  }}
                  onPointerLeave={() => {
                    setActive(null);
                    setTip(null);
                  }}
                  onFocus={() => setActive(slice.key)}
                  onBlur={() => setActive(null)}
                />
              );
            })}
          </g>

          <g className="pointer-events-none">
            <text
              x={center}
              y={center - 4}
              textAnchor="middle"
              className="fill-ink font-display text-[19px] font-semibold"
            >
              {formatMoney(activeSlice ? activeSlice.total : total, currency)}
            </text>
            <text
              x={center}
              y={center + 15}
              textAnchor="middle"
              className="fill-ink-muted font-serial text-[10px] tracking-wider uppercase"
            >
              {activeSlice ? activeSlice.name : 'total de saídas'}
            </text>
          </g>
        </svg>

        <ul className="w-full min-w-0 space-y-1.5">
          {slices.map((slice) => {
            const ink = chartInk(slice.color, dark);
            const isOpen = selected === slice.key;
            return (
              <li key={slice.key}>
                <button
                  type="button"
                  aria-pressed={onSelect ? isOpen : undefined}
                  aria-label={
                    onSelect
                      ? `${slice.name}, ${formatMoney(slice.total, currency)}. ${
                          isOpen
                            ? 'Fechar a quebra por subcategoria.'
                            : 'Abrir a quebra por subcategoria.'
                        }`
                      : undefined
                  }
                  onClick={onSelect ? () => onSelect(isOpen ? null : slice.key) : undefined}
                  onPointerEnter={() => setActive(slice.key)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(slice.key)}
                  onBlur={() => setActive(null)}
                  className={`tap flex w-full items-baseline gap-2 rounded-lg border px-2 py-1 text-left ${
                    isOpen
                      ? 'border-border-strong bg-surface-sunken'
                      : active === slice.key
                        ? 'border-transparent bg-surface-sunken'
                        : 'border-transparent'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 translate-y-px rounded-full"
                    style={{ backgroundColor: ink }}
                  />
                  <span className="text-ink min-w-0 flex-1 truncate text-sm">{slice.name}</span>
                  <span className="text-ink tnum text-sm font-medium">
                    {formatMoney(slice.total, currency)}
                  </span>
                  <span className="text-ink-muted tnum w-12 text-right text-xs">
                    {formatPercent(slice.share)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Tip tip={tip} width={width} />
    </div>
  );
}

export interface BreakdownPart {
  key: string;
  categoryId: string | null;
  name: string;
  total: number;
  share: number;
  count: number;
}

export function CategoryBreakdown({
  name,
  color,
  total,
  count,
  share,
  parts,
  rootless = false,
  currency = 'BRL',
  onClose,
}: {
  name: string;
  color: string | null;
  total: number;
  count: number;
  share: number;
  parts: BreakdownPart[];
  rootless?: boolean;
  currency?: string;
  onClose: () => void;
}) {
  const dark = useIsDark();
  const drawn = useDrawn();
  const [active, setActive] = useState<string | null>(null);

  const ramp = chartInkRamp(color, dark, parts.length);
  const ink = chartInk(color, dark);
  const loose = parts.find((part) => part.categoryId === null);

  return (
    <div
      className="border-border bg-surface-sunken mt-5 overflow-hidden rounded-2xl border"
      style={{ ['--guilloche-ink' as string]: ink }}
    >
      <div aria-hidden="true" className="guilloche h-1.5 w-full opacity-70" />

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-muted font-serial text-[11px] tracking-wider uppercase">
              Dentro de {name}
            </p>
            <p className="font-display text-ink mt-1 text-2xl font-semibold tracking-tight">
              {formatMoney(total, currency)}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm">
              {count === 1 ? '1 saída' : `${count} saídas`} · {formatPercent(share)} do período
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium"
          >
            Fechar
          </button>
        </div>

        <div
          aria-hidden="true"
          className="mt-4 grid h-3.5 gap-0.5"
          style={{
            gridTemplateColumns: parts
              .map((part) => `minmax(3px, ${Math.max(part.share, 0.001)}fr)`)
              .join(' '),
          }}
        >
          {parts.map((part, index) => (
            <span
              key={part.key}
              className="h-full"
              style={{
                transform: `scaleX(${drawn ? 1 : 0})`,
                transformOrigin: 'left center',
                transition: 'transform var(--motion-settle) var(--ease-ios-spring)',
                transitionDelay: `${index * 60}ms`,
              }}
              onPointerEnter={() => setActive(part.key)}
              onPointerLeave={() => setActive(null)}
            >
              <span
                className={`block h-full rounded-[3px] ${index === 0 ? 'rounded-l-full' : ''} ${
                  index === parts.length - 1 ? 'rounded-r-full' : ''
                }`}
                style={{
                  backgroundColor: ramp[index],
                  backgroundImage:
                    part.categoryId === null
                      ? 'repeating-linear-gradient(135deg, transparent 0 3px, var(--color-surface-sunken) 3px 5px)'
                      : undefined,
                  transform: `scaleY(${active === part.key ? 1.35 : 1})`,
                  opacity: active !== null && active !== part.key ? 0.5 : 1,
                  transition:
                    'transform var(--motion-tint) var(--ease-ios-spring), opacity var(--motion-tint) var(--ease-ios)',
                }}
              />
            </span>
          ))}
        </div>

        <ul className="mt-4 space-y-0.5">
          {parts.map((part, index) => (
            <li
              key={part.key}
              onPointerEnter={() => setActive(part.key)}
              onPointerLeave={() => setActive(null)}
              className={`animate-rise flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                active === part.key ? 'bg-surface' : ''
              }`}
              style={{ animationDelay: `${120 + index * 60}ms` }}
            >
              <span
                className="border-border bg-surface text-ink-muted font-serial tnum shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]"
                style={{ borderColor: active === part.key ? ramp[index] : undefined }}
              >
                {String(part.count).padStart(2, '0')}
                <span aria-hidden="true">×</span>
                <span className="sr-only">
                  {part.count === 1 ? ' lançamento' : ' lançamentos'}
                </span>
              </span>

              <span
                aria-hidden="true"
                className="size-2 shrink-0 translate-y-px rounded-full"
                style={{ backgroundColor: ramp[index] }}
              />

              <span className="text-ink min-w-0 flex-1 truncate text-sm">{part.name}</span>

              <span className="text-ink tnum shrink-0 text-sm font-medium">
                {formatMoney(part.total, currency)}
              </span>
              <span className="text-ink-muted tnum w-12 shrink-0 text-right text-xs">
                {formatPercent(part.share)}
              </span>
            </li>
          ))}
        </ul>

        {loose && (
          <p className="border-border text-ink-muted mt-3 border-t pt-3 text-xs">
            {rootless ? (
              <>
                {loose.count === 1 ? 'Este lançamento' : `Estes ${loose.count} lançamentos`} não
                têm categoria nenhuma — nem mãe, nem subcategoria. Abra Lançamentos para
                classificá-los e eles passam a aparecer nomeados aqui.
              </>
            ) : parts.length === 1 ? (
              <>
                Nada em {name} está em subcategoria:{' '}
                {loose.count === 1
                  ? 'o único lançamento parou'
                  : `os ${loose.count} lançamentos pararam`}{' '}
                na própria categoria. Crie subcategorias em Categorias para quebrar este
                número.
              </>
            ) : (
              <>
                {loose.count === 1 ? 'Um lançamento ficou' : `${loose.count} lançamentos ficaram`}{' '}
                direto em {name}: nem eles nem a recorrência que os gerou apontam para alguma
                subcategoria. Classifique em Lançamentos para vê-los nomeados aqui.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export interface MonthColumn {
  competence: string;
  income: number;
  expense: number;
  net: number;
}

export function MonthlyColumns({
  months,
  currency = 'BRL',
}: {
  months: MonthColumn[];
  currency?: string;
}) {
  const drawn = useDrawn();
  const [tip, setTip] = useState<TipState | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [ref, width] = useMeasure<HTMLDivElement>();

  const height = 260;
  const padding = { top: 18, right: 8, bottom: 30, left: 46 };
  const plotWidth = Math.max(width - padding.left - padding.right, 60);
  const plotHeight = height - padding.top - padding.bottom;
  const zero = padding.top + plotHeight / 2;

  const peak = Math.max(...months.map((m) => Math.max(m.income, m.expense)), 1);
  const scale = (value: number) => (value / peak) * (plotHeight / 2);

  const band = plotWidth / Math.max(months.length, 1);
  const barWidth = Math.min(Math.max(band / 2 - 6, 6), 24);

  const ticks = [-1, -0.5, 0, 0.5, 1];

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Entradas e saídas por mês">
          <g aria-hidden="true" className="text-border">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={padding.left}
                x2={width - padding.right}
                y1={zero - (plotHeight / 2) * tick}
                y2={zero - (plotHeight / 2) * tick}
                stroke="currentColor"
                strokeWidth={tick === 0 ? 1 : 0.5}
              />
            ))}
          </g>

          <g aria-hidden="true">
            {ticks.map((tick) => (
              <text
                key={tick}
                x={padding.left - 8}
                y={zero - (plotHeight / 2) * tick + 3.5}
                textAnchor="end"
                className="fill-ink-muted font-serial text-[10px]"
              >
                {formatCompact(Math.abs(peak * tick))}
              </text>
            ))}
          </g>

          {months.map((month, index) => {
            const x = padding.left + band * index + band / 2;
            const isActive = active === month.competence;
            const label = formatCompetence(month.competence);

            return (
              <g
                key={month.competence}
                tabIndex={0}
                role="button"
                aria-label={`${label}: entradas ${formatMoney(month.income, currency)}, saídas ${formatMoney(month.expense, currency)}`}
                className="cursor-pointer outline-offset-2"
                onPointerEnter={(event) => {
                  setActive(month.competence);
                  const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setTip({
                    x: box ? x : 0,
                    y: box ? Math.max(event.clientY - box.top, 60) : 60,
                    title: label,
                    rows: [
                      {
                        label: 'entradas',
                        value: formatMoney(month.income, currency),
                        color: 'var(--color-positive)',
                      },
                      {
                        label: 'saídas',
                        value: formatMoney(month.expense, currency),
                        color: 'var(--color-negative)',
                      },
                      { label: 'resultado', value: formatMoney(month.net, currency) },
                    ],
                  });
                }}
                onPointerLeave={() => {
                  setActive(null);
                  setTip(null);
                }}
                onFocus={() => setActive(month.competence)}
                onBlur={() => setActive(null)}
              >
                <rect
                  x={padding.left + band * index}
                  y={padding.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                />
                {isActive && (
                  <rect
                    x={padding.left + band * index + 1}
                    y={padding.top}
                    width={band - 2}
                    height={plotHeight}
                    rx={8}
                    className="fill-surface-sunken"
                  />
                )}

                <Column
                  x={x - barWidth - 1}
                  width={barWidth}
                  zero={zero}
                  length={scale(month.income)}
                  direction="up"
                  fill="var(--color-positive)"
                  drawn={drawn}
                  delay={index * 45}
                />
                <Column
                  x={x + 1}
                  width={barWidth}
                  zero={zero}
                  length={scale(month.expense)}
                  direction="down"
                  fill="var(--color-negative)"
                  drawn={drawn}
                  delay={index * 45 + 20}
                />

                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`font-serial text-[10px] ${isActive ? 'fill-ink' : 'fill-ink-muted'}`}
                >
                  {shortMonth(month.competence)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <Legend
        items={[
          { label: 'Entradas', color: 'var(--color-positive)', hint: 'acima da linha' },
          { label: 'Saídas', color: 'var(--color-negative)', hint: 'abaixo da linha' },
        ]}
      />

      <Tip tip={tip} width={width} />
    </div>
  );
}

export interface DayColumn {
  date: string;
  income: number;
  expense: number;
  net: number;
}

export function DailyColumns({
  days,
  currency = 'BRL',
  selected = null,
  onSelect,
}: {
  days: DayColumn[];
  currency?: string;
  selected?: string | null;
  onSelect?: (date: string | null) => void;
}) {
  const drawn = useDrawn();
  const [tip, setTip] = useState<TipState | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [ref, width] = useMeasure<HTMLDivElement>();

  const height = 240;
  const padding = { top: 18, right: 8, bottom: 30, left: 46 };
  const plotWidth = Math.max(width - padding.left - padding.right, 60);
  const plotHeight = height - padding.top - padding.bottom;
  const zero = padding.top + plotHeight / 2;

  const peak = Math.max(...days.map((day) => Math.max(day.income, day.expense)), 1);
  const scale = (value: number) => (value / peak) * (plotHeight / 2);

  const band = plotWidth / Math.max(days.length, 1);
  const barWidth = Math.min(Math.max(band / 2 - 1.5, 1.5), 10);

  const step = Math.max(1, Math.ceil(days.length / 8));
  const ticks = [-1, -0.5, 0, 0.5, 1];

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Entradas e saídas por dia">
          <g aria-hidden="true">
            {days.map((day, index) =>
              isWeekend(day.date) ? (
                <rect
                  key={day.date}
                  x={padding.left + band * index}
                  y={padding.top}
                  width={band}
                  height={plotHeight}
                  className="fill-surface-sunken"
                  opacity={0.6}
                />
              ) : null,
            )}
          </g>

          <g aria-hidden="true" className="text-border">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={padding.left}
                x2={width - padding.right}
                y1={zero - (plotHeight / 2) * tick}
                y2={zero - (plotHeight / 2) * tick}
                stroke="currentColor"
                strokeWidth={tick === 0 ? 1 : 0.5}
              />
            ))}
          </g>

          <g aria-hidden="true">
            {ticks.map((tick) => (
              <text
                key={tick}
                x={padding.left - 8}
                y={zero - (plotHeight / 2) * tick + 3.5}
                textAnchor="end"
                className="fill-ink-muted font-serial text-[10px]"
              >
                {formatCompact(Math.abs(peak * tick))}
              </text>
            ))}
          </g>

          {days.map((day, index) => {
            const x = padding.left + band * index + band / 2;
            const isActive = active === day.date;
            const isOpen = selected === day.date;
            const moved = day.income > 0 || day.expense > 0;
            const label = formatDayLong(day.date);
            const target = moved && onSelect !== undefined;

            return (
              <g
                key={day.date}
                tabIndex={moved ? 0 : undefined}
                role={moved ? 'button' : undefined}
                aria-pressed={target ? isOpen : undefined}
                aria-label={
                  moved
                    ? `${label}: entradas ${formatMoney(day.income, currency)}, saídas ${formatMoney(day.expense, currency)}.${
                        target
                          ? isOpen
                            ? ' Fechar os lançamentos do dia.'
                            : ' Abrir os lançamentos do dia.'
                          : ''
                      }`
                    : undefined
                }
                className={moved ? 'cursor-pointer outline-offset-2' : undefined}
                onClick={target ? () => onSelect(isOpen ? null : day.date) : undefined}
                onKeyDown={
                  target
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        onSelect(isOpen ? null : day.date);
                      }
                    : undefined
                }
                onPointerEnter={(event) => {
                  setActive(day.date);
                  const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setTip({
                    x: box ? x : 0,
                    y: box ? Math.max(event.clientY - box.top, 60) : 60,
                    title: label,
                    rows: [
                      {
                        label: 'entradas',
                        value: formatMoney(day.income, currency),
                        color: 'var(--color-positive)',
                      },
                      {
                        label: 'saídas',
                        value: formatMoney(day.expense, currency),
                        color: 'var(--color-negative)',
                      },
                      { label: 'resultado', value: formatMoney(day.net, currency) },
                    ],
                  });
                }}
                onPointerLeave={() => {
                  setActive(null);
                  setTip(null);
                }}
                onFocus={() => setActive(day.date)}
                onBlur={() => setActive(null)}
              >
                <rect
                  x={padding.left + band * index}
                  y={padding.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                />
                {(isOpen || isActive) && (
                  <rect
                    x={padding.left + band * index}
                    y={padding.top}
                    width={band}
                    height={plotHeight}
                    rx={Math.min(4, band / 2)}
                    className={isOpen ? 'fill-primary-soft' : 'fill-surface-sunken'}
                  />
                )}

                <Column
                  x={x - barWidth - 0.75}
                  width={barWidth}
                  zero={zero}
                  length={scale(day.income)}
                  direction="up"
                  fill="var(--color-positive)"
                  drawn={drawn}
                  delay={index * 12}
                />
                <Column
                  x={x + 0.75}
                  width={barWidth}
                  zero={zero}
                  length={scale(day.expense)}
                  direction="down"
                  fill="var(--color-negative)"
                  drawn={drawn}
                  delay={index * 12 + 10}
                />

                {(index % step === 0 || isActive || isOpen) && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className={`font-serial text-[10px] ${
                      isOpen
                        ? 'fill-primary-ink font-bold'
                        : isActive
                          ? 'fill-ink'
                          : 'fill-ink-muted'
                    }`}
                  >
                    {Number(day.date.slice(8, 10))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <Legend
        items={[
          { label: 'Entradas', color: 'var(--color-positive)', hint: 'acima da linha' },
          { label: 'Saídas', color: 'var(--color-negative)', hint: 'abaixo da linha' },
        ]}
      />

      <Tip tip={tip} width={width} />
    </div>
  );
}

function isWeekend(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function Column({
  x,
  width,
  zero,
  length,
  direction,
  fill,
  drawn,
  delay,
}: {
  x: number;
  width: number;
  zero: number;
  length: number;
  direction: 'up' | 'down';
  fill: string;
  drawn: boolean;
  delay: number;
}) {
  if (length <= 0) return null;

  const r = Math.min(4, width / 2);
  const up = direction === 'up';
  const height = Math.max(length, 2);
  const y = up ? zero - height : zero;

  return (
    <path
      d={
        up
          ? `M ${x} ${zero} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${zero} Z`
          : `M ${x} ${zero} L ${x} ${y + height - r} Q ${x} ${y + height} ${x + r} ${y + height} L ${x + width - r} ${y + height} Q ${x + width} ${y + height} ${x + width} ${y + height - r} L ${x + width} ${zero} Z`
      }
      fill={fill}
      style={{
        transformBox: 'view-box',
        transformOrigin: `0px ${zero}px`,
        transform: `scaleY(${drawn ? 1 : 0})`,
        transition: 'transform var(--motion-settle) var(--ease-ios)',
        transitionDelay: `${delay}ms`,
      }}
    />
  );
}

function shortMonth(competence: string): string {
  const [, month] = competence.split('-').map(Number);
  return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][
    month - 1
  ];
}

function Legend({ items }: { items: Array<{ label: string; color: string; hint?: string }> }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-ink text-xs font-medium">{item.label}</span>
          {item.hint && <span className="text-ink-muted text-xs">({item.hint})</span>}
        </li>
      ))}
    </ul>
  );
}

export interface SeriesPoint {
  date: string;
  net: number;
  cumulative: number;
}

export function CumulativeArea({
  points,
  currency = 'BRL',
}: {
  points: SeriesPoint[];
  currency?: string;
}) {
  const drawn = useDrawn();
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const height = 220;
  const padding = { top: 16, right: 12, bottom: 26, left: 46 };
  const plotWidth = Math.max(width - padding.left - padding.right, 60);
  const plotHeight = height - padding.top - padding.bottom;

  const values = points.map((point) => point.cumulative);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (index: number) =>
    padding.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - ((value - min) / span) * plotHeight;

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.cumulative)}`)
    .join(' ');
  const area = points.length
    ? `${line} L ${x(points.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`
    : '';

  const last = points[points.length - 1];
  const current = hover !== null ? points[hover] : null;

  const onMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const relative = event.clientX - box.left - padding.left;
      const index = Math.round((relative / plotWidth) * (points.length - 1));
      setHover(Math.min(Math.max(index, 0), points.length - 1));
    },
    [plotWidth, points.length, padding.left],
  );

  return (
    <div ref={ref} className="relative">
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Acumulado do período, terminando em ${formatMoney(last?.cumulative ?? 0, currency)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g aria-hidden="true" className="text-border">
            {[0, 0.5, 1].map((tick) => (
              <line
                key={tick}
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + plotHeight * tick}
                y2={padding.top + plotHeight * tick}
                stroke="currentColor"
                strokeWidth={0.5}
              />
            ))}
            {min < 0 && max > 0 && (
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(0)}
                y2={y(0)}
                stroke="currentColor"
                strokeWidth={1}
              />
            )}
          </g>

          <g aria-hidden="true">
            {[1, 0.5, 0].map((tick) => (
              <text
                key={tick}
                x={padding.left - 8}
                y={padding.top + plotHeight * (1 - tick) + 3.5}
                textAnchor="end"
                className="fill-ink-muted font-serial text-[10px]"
              >
                {formatCompact(min + span * tick)}
              </text>
            ))}
          </g>

          <path
            d={area}
            fill="url(#area-fade)"
            style={{
              opacity: drawn ? 1 : 0,
              transition: 'opacity var(--motion-settle) var(--ease-ios) 200ms',
            }}
          />

          <path
            d={line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: drawn ? 0 : 1,
              transition: 'stroke-dashoffset 900ms var(--ease-ios)',
            }}
          />

          {current && hover !== null && (
            <g aria-hidden="true">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                className="text-border-strong"
                stroke="currentColor"
                strokeWidth={1}
              />
              <circle
                cx={x(hover)}
                cy={y(current.cumulative)}
                r={5}
                fill="var(--color-primary)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}

          {!current && last && (
            <circle
              cx={x(points.length - 1)}
              cy={y(last.cumulative)}
              r={5}
              fill="var(--color-primary)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              style={{
                opacity: drawn ? 1 : 0,
                transition: 'opacity var(--motion-tint) var(--ease-ios) 700ms',
              }}
            />
          )}

          <g aria-hidden="true">
            <text
              x={padding.left}
              y={height - 8}
              className="fill-ink-muted font-serial text-[10px]"
            >
              {dayLabel(points[0].date)}
            </text>
            <text
              x={width - padding.right}
              y={height - 8}
              textAnchor="end"
              className="fill-ink-muted font-serial text-[10px]"
            >
              {dayLabel(last.date)}
            </text>
          </g>
        </svg>
      )}

      {current && hover !== null && (
        <Tip
          tip={{
            x: x(hover),
            y: y(current.cumulative),
            title: dayLabel(current.date),
            rows: [
              {
                label: 'acumulado',
                value: formatMoney(current.cumulative, currency),
                color: 'var(--color-primary)',
              },
              { label: 'no dia', value: formatMoney(current.net, currency) },
            ],
          }}
          width={width}
        />
      )}
    </div>
  );
}

function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

export function BudgetMeter({
  name,
  color,
  spent,
  budget,
  currency = 'BRL',
}: {
  name: string;
  color: string | null;
  spent: number;
  budget: number;
  currency?: string;
}) {
  const dark = useIsDark();
  const drawn = useDrawn();
  const ink = chartInk(color, dark);
  const ratio = budget > 0 ? spent / budget : 0;
  const over = ratio > 1;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink flex min-w-0 items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: ink }}
          />
          <span className="truncate">{name}</span>
        </span>
        <span className="tnum shrink-0 text-sm">
          <span className={over ? 'text-negative font-semibold' : 'text-ink'}>
            {formatMoney(spent, currency)}
          </span>
          <span className="text-ink-muted"> / {formatMoney(budget, currency)}</span>
        </span>
      </div>

      <div
        className="bg-surface-sunken mt-1.5 h-2 overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${formatPercent(ratio)} do orçamento`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: drawn ? `${Math.min(ratio, 1) * 100}%` : '0%',
            backgroundColor: over ? 'var(--color-negative)' : ink,
            transition: 'width var(--motion-settle) var(--ease-ios)',
          }}
        />
      </div>

      <p className="text-ink-muted mt-1 text-xs">
        {over ? (
          <span className="text-negative font-medium">
            Estourou {formatMoney(spent - budget, currency)}
          </span>
        ) : (
          `Restam ${formatMoney(budget - spent, currency)} · ${formatPercent(ratio)} usado`
        )}
      </p>
    </li>
  );
}

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  hint?: string;
  leading?: ReactNode;
  sub?: string;
}

export function RankedBars({
  items,
  currency = 'BRL',
  onSelect,
  selected,
  selectHint,
}: {
  items: RankedItem[];
  currency?: string;
  onSelect?: (key: string) => void;
  selected?: string[];
  selectHint?: (item: RankedItem, on: boolean) => string;
}) {
  const drawn = useDrawn();
  const peak = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => {
        const on = selected?.includes(item.key) ?? false;

        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {item.leading}
                <span className="min-w-0">
                  <span className="text-ink block truncate text-left text-sm">{item.label}</span>
                  {item.sub && (
                    <span className="text-ink-muted block truncate text-left text-xs">
                      {item.sub}
                    </span>
                  )}
                </span>
              </span>
              <span className="text-ink tnum shrink-0 text-sm font-medium">
                {formatMoney(item.value, currency)}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <div className="bg-surface-sunken h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{
                    width: drawn ? `${(item.value / peak) * 100}%` : '0%',
                    transition: 'width var(--motion-settle) var(--ease-ios)',
                    transitionDelay: `${index * 40}ms`,
                  }}
                />
              </div>
              {item.hint && (
                <span className="text-ink-muted font-serial shrink-0 text-[10px]">{item.hint}</span>
              )}
            </div>
          </>
        );

        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={on}
                aria-label={selectHint?.(item, on)}
                onClick={() => onSelect(item.key)}
                className={`tap block w-full rounded-xl border px-2 py-1.5 ${
                  on ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-sunken'
                }`}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

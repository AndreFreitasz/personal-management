import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';

import { CONTROL, CONTROL_SIZE, type ControlSize } from './control';

function toDate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toTyped(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function fromTyped(typed: string): string {
  const digits = typed.replace(/\D/g, '');
  if (digits.length !== 8) return '';

  const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  return toDate(iso) ? iso : '';
}

function maskDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

function Popover({
  open,
  onClose,
  anchorRef,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const node = panel.current;
    if (!anchor || !node) return;

    const box = anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = node;

    const roomBelow = window.innerHeight - box.bottom;
    const flip = roomBelow < height + POPOVER_GAP + VIEWPORT_MARGIN && box.top > roomBelow;

    setAt({
      top: flip
        ? Math.max(VIEWPORT_MARGIN, box.top - height - POPOVER_GAP)
        : Math.min(box.bottom + POPOVER_GAP, window.innerHeight - height - VIEWPORT_MARGIN),
      left: Math.min(
        Math.max(VIEWPORT_MARGIN, box.left),
        Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
      ),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, onClose, anchorRef, place]);

  if (!open) return null;

  const host = anchorRef.current?.closest('dialog') ?? document.body;

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className="border-border bg-surface shadow-card-hero animate-rise fixed z-50 rounded-2xl border p-3"
      style={{ top: at?.top ?? 0, left: at?.left ?? 0, visibility: at ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    host,
  );
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none">
      <rect
        x="2.75"
        y="4.25"
        width="14.5"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M2.75 8.25h14.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.75 2.75v3M13.25 2.75v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PICKER_CLASSES = {
  months: 'flex flex-col',
  month_caption: 'flex items-center justify-center h-9 text-sm font-semibold text-ink',
  nav: 'absolute top-1 right-1 left-1 flex items-center justify-between',
  button_previous:
    'tap grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-primary-soft hover:text-primary-ink disabled:opacity-30',
  button_next:
    'tap grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-primary-soft hover:text-primary-ink disabled:opacity-30',
  weekday: 'text-ink-muted font-serial text-[10px] font-normal uppercase tracking-wide pb-1',
  day: 'p-0.5',
  day_button:
    'tap tnum grid size-9 place-items-center rounded-lg text-sm text-ink hover:bg-primary-soft hover:text-primary-ink',
  selected: '[&_button]:bg-primary [&_button]:text-on-primary [&_button]:font-semibold',
  today: '[&_button]:text-primary-ink [&_button]:font-semibold',
  outside: '[&_button]:text-ink-muted [&_button]:opacity-40',
  disabled: '[&_button]:opacity-30 [&_button]:pointer-events-none',
  root: 'relative',
} as const;

interface DateFieldProps {
  name?: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: ControlSize;
  'aria-label'?: string;
  onChange?: (iso: string) => void;
}

export function DateField({
  name,
  id,
  defaultValue = '',
  required = false,
  disabled = false,
  size = 'md',
  onChange,
  ...rest
}: DateFieldProps) {
  const [iso, setIso] = useState(defaultValue);
  const [typed, setTyped] = useState(() => toTyped(defaultValue));
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const seeded = useRef(defaultValue);
  useEffect(() => {
    if (seeded.current === defaultValue) return;
    seeded.current = defaultValue;
    setIso(defaultValue);
    setTyped(toTyped(defaultValue));
  }, [defaultValue]);

  function commit(next: string) {
    setIso(next);
    onChange?.(next);
  }

  const selected = toDate(iso);
  const incomplete = typed.length > 0 && !iso;

  return (
    <div ref={anchor} className="relative">
      <input
        {...rest}
        ref={field}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={typed}
        disabled={disabled}
        required={required}
        aria-describedby={hintId}
        aria-invalid={incomplete || undefined}
        onChange={(event) => {
          const masked = maskDate(event.target.value);
          setTyped(masked);
          commit(fromTyped(masked));
        }}
        className={`${CONTROL} ${CONTROL_SIZE[size]} tnum pr-11`}
      />
      <span id={hintId} className="sr-only">
        Data no formato dia, mês e ano. Use o botão ao lado para abrir o
        calendário.
      </span>

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? 'Fechar o calendário' : 'Abrir o calendário'}
        onClick={() => setOpen((value) => !value)}
        className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg disabled:opacity-50"
      >
        <CalendarGlyph />
      </button>

      <Popover
        open={open}
        anchorRef={anchor}
        label="Escolher data"
        onClose={() => {
          setOpen(false);
          field.current?.focus();
        }}
      >
        <DayPicker
          animate
          mode="single"
          locale={ptBR}
          autoFocus
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            const next = toIso(date);
            setTyped(toTyped(next));
            commit(next);
            setOpen(false);
            field.current?.focus();
          }}
          classNames={PICKER_CLASSES}
        />
      </Popover>

      {name && <input type="hidden" name={name} value={iso} />}
    </div>
  );
}

const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function MonthField({
  name,
  id,
  defaultValue = '',
  required = false,
  disabled = false,
  size = 'md',
  onChange,
  ...rest
}: DateFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [typed, setTyped] = useState(() => monthToTyped(defaultValue));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(defaultValue.slice(0, 4)) || new Date().getFullYear());
  const anchor = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const seeded = useRef(defaultValue);
  useEffect(() => {
    if (seeded.current === defaultValue) return;
    seeded.current = defaultValue;
    setValue(defaultValue);
    setTyped(monthToTyped(defaultValue));
  }, [defaultValue]);

  function commit(next: string) {
    setValue(next);
    onChange?.(next);
  }

  return (
    <div ref={anchor} className="relative">
      <input
        {...rest}
        ref={field}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="mm/aaaa"
        value={typed}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
          const masked = digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
          setTyped(masked);

          if (digits.length === 6) {
            const month = Number(digits.slice(0, 2));
            if (month >= 1 && month <= 12) {
              commit(`${digits.slice(2)}-${digits.slice(0, 2)}`);
              return;
            }
          }
          commit('');
        }}
        className={`${CONTROL} ${CONTROL_SIZE[size]} tnum pr-11`}
      />

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? 'Fechar o seletor de mês' : 'Abrir o seletor de mês'}
        onClick={() => setOpen((v) => !v)}
        className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg disabled:opacity-50"
      >
        <CalendarGlyph />
      </button>

      <Popover
        open={open}
        anchorRef={anchor}
        label="Escolher o mês"
        onClose={() => {
          setOpen(false);
          field.current?.focus();
        }}
      >
        <div className="w-64">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => setYear((y) => y - 1)}
              className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink grid size-8 place-items-center rounded-lg"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span className="text-ink tnum text-sm font-semibold">{year}</span>
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => setYear((y) => y + 1)}
              className="tap text-ink-muted hover:bg-primary-soft hover:text-primary-ink grid size-8 place-items-center rounded-lg"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, index) => {
              const competence = `${year}-${String(index + 1).padStart(2, '0')}`;
              const on = value === competence;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTyped(monthToTyped(competence));
                    commit(competence);
                    setOpen(false);
                    field.current?.focus();
                  }}
                  className={`tap rounded-lg py-2 text-sm ${
                    on
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'text-ink hover:bg-primary-soft hover:text-primary-ink'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}

function monthToTyped(competence: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(competence);
  return match ? `${match[2]}/${match[1]}` : '';
}

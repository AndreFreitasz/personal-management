import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { CONTROL, CONTROL_SIZE, type ControlSize } from './control';

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-page mx-auto w-full px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type { ControlSize };

const BUTTON_SIZE: Record<ControlSize, string> = {
  md: 'rounded-lg px-3.5 py-2 text-sm',
  lg: 'rounded-xl px-5 py-3 text-base',
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-tap hover:bg-primary-hover hover:shadow-tap-hover',
  secondary:
    'border border-border-strong text-ink hover:border-primary hover:bg-primary-soft hover:text-primary-ink',
  ghost: 'text-ink-muted hover:bg-primary-soft hover:text-primary-ink',
  danger: 'text-negative hover:bg-negative-soft',
};

const BUTTON_LIFT: Record<ButtonVariant, string> = {
  primary: 'tap-lift',
  secondary: '',
  ghost: '',
  danger: '',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`tap ${BUTTON_LIFT[variant]} ${BUTTON_SIZE[size]} inline-flex items-center justify-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANT[variant]} ${className}`}
    />
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-ink-muted text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
}

export function Input({ size = 'md', className = '', ...props }: InputProps) {
  return <input {...props} className={`${CONTROL} ${CONTROL_SIZE[size]} ${className}`} />;
}

export function Select({ size = 'md', className = '', ...props }: SelectProps) {
  return <select {...props} className={`${CONTROL} ${CONTROL_SIZE[size]} ${className}`} />;
}

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="collapse-ios"
      data-open={open}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === 'grid-template-rows' &&
          !open
        ) {
          setMounted(false);
        }
      }}
    >
      <div>{children}</div>
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  size = 'sm',
  locked = false,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  size?: 'sm' | 'lg';
  locked?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`dialog-ios border-border bg-surface shadow-card-hero text-ink m-auto w-[calc(100%-2rem)] rounded-2xl border p-0 ${
        size === 'lg' ? 'max-w-xl' : 'max-w-sm'
      }`}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <div className="flex max-h-[85vh] flex-col p-5">
        <h2 id={titleId} className="font-display text-ink text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="text-ink-muted mt-1.5 text-sm">{description}</p>}

        {children && (
          <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
        )}

        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      locked={pending}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Excluindo…' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      style={style}
      className={`border-border bg-surface shadow-card rounded-2xl border p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-ink text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-ink-muted mt-0.5 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p role="status" className="text-ink-muted py-8 text-center text-sm">
      {label}
    </p>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-ink-muted mx-auto mt-1 max-w-sm text-sm">{hint}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Erro desconhecido.';

  return (
    <div className="border-negative/40 bg-surface-sunken rounded-lg border px-6 py-8 text-center">
      <p className="text-ink text-sm font-medium">Não foi possível carregar</p>
      <p className="text-ink-muted mt-1 text-sm">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
    </div>
  );
}

export interface Segment<T extends string> {
  value: T;
  label: string;
  short?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active) return setPill(null);
      const next = { x: active.offsetLeft, w: active.offsetWidth };
      setPill((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className="bg-surface-sunken no-scrollbar relative flex w-full gap-0.5 overflow-x-auto rounded-xl p-1 sm:w-auto"
    >
      {pill && (
        <span
          aria-hidden="true"
          className="nav-pill bg-surface shadow-tap absolute inset-y-1 left-0 rounded-lg"
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}

      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`tap relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
            option.value === value ? 'text-primary-ink' : 'text-ink-muted hover:text-primary-ink'
          }`}
        >
          {option.short ? (
            <>
              <span className="sm:hidden">{option.short}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </>
          ) : (
            option.label
          )}
        </button>
      ))}
    </div>
  );
}

export function FilterChip({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span className="border-border bg-surface text-ink inline-flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-xs">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="tap text-ink-muted hover:bg-negative-soft hover:text-negative grid size-5 place-items-center rounded-full"
      >
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}

export function CategoryPicker({
  categories,
  value,
  resetKey,
  hint,
}: {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  value: string | null;
  resetKey?: string;
  hint?: string;
}) {
  const roots = categories.filter((category) => category.parentId === null);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  const selected = categories.find((category) => category.id === value);
  const initialParent = selected?.parentId ?? selected?.id ?? '';
  const initialChild = selected?.parentId ? selected.id : '';

  const [parent, setParent] = useState(initialParent);
  const [child, setChild] = useState(initialChild);
  const [key, setKey] = useState(resetKey);

  if (key !== resetKey) {
    setKey(resetKey);
    setParent('');
    setChild('');
  }

  const options = parent ? childrenOf(parent) : [];

  return (
    <>
      <input type="hidden" name="categoryId" value={child || parent} />

      <Field label="Categoria" hint={hint}>
        {(id) => (
          <Select
            id={id}
            value={parent}
            onChange={(event) => {
              setParent(event.target.value);
              setChild('');
            }}
          >
            <option value="">Sem categoria</option>
            {roots.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {options.length > 0 && (
        <Field label="Subcategoria" hint="Opcional — sem escolher, fica na categoria.">
          {(id) => (
            <Select id={id} value={child} onChange={(event) => setChild(event.target.value)}>
              <option value="">Toda a categoria</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </>
  );
}

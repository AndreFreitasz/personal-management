import { useEffect, useId, useRef, useState } from 'react';

import { CONTROL, CONTROL_SIZE, type ControlSize } from './control';

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

function toDisplay(digits: string): string {
  const clean = digits.replace(/^0+(?=\d{3})/, '');
  if (!clean) return '';

  const padded = clean.padStart(3, '0');
  const cents = padded.slice(-2);
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${whole},${cents}`;
}

function toCanonical(digits: string): string {
  const clean = digits.replace(/^0+(?=\d{3})/, '');
  if (!clean) return '';

  const padded = clean.padStart(3, '0');
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function digitsFromValue(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '';

  const text = String(value);
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return digitsOf(text);

  return String(Math.round(Math.abs(parsed) * 100));
}

interface MoneyInputProps {
  name?: string;
  id?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: ControlSize;
  className?: string;
  'aria-label'?: string;
  onCommit?: (value: string) => void;
}

export function MoneyInput({
  name,
  id,
  defaultValue,
  placeholder = '0,00',
  required = false,
  disabled = false,
  size = 'md',
  className = '',
  onCommit,
  ...rest
}: MoneyInputProps) {
  const [digits, setDigits] = useState(() => digitsFromValue(defaultValue));
  const prefixId = useId();
  const input = useRef<HTMLInputElement>(null);

  const seeded = useRef(defaultValue);
  useEffect(() => {
    if (seeded.current === defaultValue) return;
    seeded.current = defaultValue;
    setDigits(digitsFromValue(defaultValue));
  }, [defaultValue]);

  const display = toDisplay(digits);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="text-ink-muted pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm"
      >
        R$
      </span>
      <span id={prefixId} className="sr-only">
        Valor em reais
      </span>

      <input
        {...rest}
        ref={input}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-describedby={prefixId}
        onChange={(event) => setDigits(digitsOf(event.target.value).slice(0, 12))}
        onBlur={() => onCommit?.(toCanonical(digits))}
        className={`${CONTROL} ${CONTROL_SIZE[size]} tnum pl-9 text-right ${className}`}
      />

      {name && <input type="hidden" name={name} value={toCanonical(digits)} />}
    </div>
  );
}

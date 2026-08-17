import { useState } from 'react';

import { formatMoney } from '@/lib/format';
import type { CategoryKind, TransactionType } from '@/lib/resources';
import { TRANSACTION_TYPE_LABEL, TRANSACTION_TYPE_SIGN } from '@/lib/resources';

function useValueSwap(value: number) {
  const [swap, setSwap] = useState({ value, tick: 0, direction: 'up' as 'up' | 'down' });

  if (swap.value !== value) {
    setSwap({
      value,
      tick: swap.tick + 1,
      direction: value > swap.value ? 'up' : 'down',
    });
  }

  return swap;
}

export function Amount({
  value,
  type,
  currency = 'BRL',
  className = '',
}: {
  value: number;
  type: TransactionType;
  currency?: string;
  className?: string;
}) {
  const tone =
    type === 'credit' ? 'text-positive' : type === 'debit' ? 'text-negative' : 'text-ink';

  return (
    <span className={`tnum ${tone} ${className}`}>
      <span aria-hidden="true">{TRANSACTION_TYPE_SIGN[type]}</span>
      {formatMoney(value, currency)}
      <span className="sr-only"> {TRANSACTION_TYPE_LABEL[type]}</span>
    </span>
  );
}

export function Balance({
  value,
  currency = 'BRL',
  signed = false,
}: {
  value: number;
  currency?: string;
  signed?: boolean;
}) {
  const swap = useValueSwap(value);

  return (
    <span className={`tnum ${value < 0 ? 'text-negative' : signed ? 'text-positive' : 'text-ink'}`}>
      <span
        key={swap.tick}
        data-direction={swap.direction}
        className={swap.tick > 0 ? 'value-swap' : undefined}
      >
        {signed ? (
          <>
            <span aria-hidden="true">{value < 0 ? '−' : '+'}</span>
            {formatMoney(Math.abs(value), currency)}
          </>
        ) : (
          formatMoney(value, currency)
        )}
      </span>
      {value < 0 && <span className="sr-only"> negativo</span>}
      {signed && value >= 0 && <span className="sr-only"> positivo</span>}
    </span>
  );
}

const KIND_SWATCH: Record<CategoryKind, string> = {
  expense: 'bg-cat-food',
  income: 'bg-positive',
  transfer: 'bg-cat-invested',
};

export function CategoryDot({ color, kind }: { color: string | null; kind: CategoryKind }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${color ? '' : KIND_SWATCH[kind]}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

import { useEffect, useId, useState } from 'react';

import type { Bank } from '@/lib/banks';
import { BANK_GROUP_LABEL, BANKS_BY_GROUP, bankOf, initialsOf } from '@/lib/banks';
import { Button, Modal } from './ui';

const SIZE = {
  sm: { box: 20, radius: 6, text: 9 },
  md: { box: 28, radius: 8, text: 11 },
  lg: { box: 36, radius: 10, text: 14 },
} as const;

export function AccountIcon({
  icon,
  name,
  size = 'md',
}: {
  icon: string | null | undefined;
  name: string;
  size?: keyof typeof SIZE;
}) {
  const bank = bankOf(icon);
  const { box, radius, text } = SIZE[size];
  const mark = bank?.mark ?? initialsOf(name);

  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [icon]);

  if (icon && !broken) {
    return (
      <img
        src={`/banks/${icon}.svg`}
        alt=""
        aria-hidden="true"
        width={box}
        height={box}
        loading="lazy"
        onError={() => setBroken(true)}
        className="ring-ink/10 shrink-0 ring-1 ring-inset"
        style={{ width: box, height: box, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`ring-ink/10 grid shrink-0 place-items-center ring-1 ring-inset ${
        bank ? '' : 'bg-surface-sunken text-ink-muted'
      }`}
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        ...(bank ? { backgroundColor: bank.bg, color: bank.fg } : {}),
      }}
    >
      <span
        className="font-serial leading-none font-bold"
        style={{ fontSize: mark.length > 1 ? text - 1 : text + 1 }}
      >
        {mark}
      </span>
    </span>
  );
}

export function AccountIconPicker({
  open,
  value,
  accountName,
  onPick,
  onClose,
}: {
  open: boolean;
  value: string | null;
  accountName: string;
  onPick: (slug: string | null) => void;
  onClose: () => void;
}) {
  const group = useId();

  return (
    <Modal
      open={open}
      title="Marca da conta"
      description="O desenho aparece na carteira, nos filtros e no comparativo entre cartões."
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="text-ink-muted font-serial text-[11px] tracking-wider uppercase">
            Sem marca
          </legend>
          <div className="mt-2">
            <Option
              group={group}
              checked={value === null}
              label="Iniciais da conta"
              onSelect={() => onPick(null)}
              icon={<AccountIcon icon={null} name={accountName || 'Conta'} size="lg" />}
            />
          </div>
        </fieldset>

        {BANKS_BY_GROUP.map(({ group: kind, banks }) => (
          <fieldset key={kind}>
            <legend className="text-ink-muted font-serial text-[11px] tracking-wider uppercase">
              {BANK_GROUP_LABEL[kind]}
            </legend>
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {banks.map((bank) => (
                <Option
                  key={bank.slug}
                  group={group}
                  checked={value === bank.slug}
                  label={bank.name}
                  onSelect={() => onPick(bank.slug)}
                  icon={<AccountIcon icon={bank.slug} name={bank.name} size="lg" />}
                  bank={bank}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}

function Option({
  group,
  checked,
  label,
  icon,
  bank,
  onSelect,
}: {
  group: string;
  checked: boolean;
  label: string;
  icon: React.ReactNode;
  bank?: Bank;
  onSelect: () => void;
}) {
  return (
    <label
      className={`tap has-focus-visible:ring-primary flex cursor-pointer items-center gap-2 rounded-xl border p-2 has-focus-visible:ring-2 ${
        checked
          ? 'border-primary bg-primary-soft text-primary-ink'
          : 'border-border text-ink-muted hover:border-primary hover:text-primary-ink'
      }`}
      title={bank ? bank.name : label}
    >
      <input
        type="radio"
        name={group}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
        aria-label={label}
      />
      {icon}
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
    </label>
  );
}

export function AccountIconField({
  value,
  accountName,
  onChange,
}: {
  value: string | null;
  accountName: string;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const bank = bankOf(value);

  return (
    <div className="flex items-center gap-3">
      <AccountIcon icon={value} name={accountName || 'Conta'} size="lg" />
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {bank ? bank.name : 'Escolher marca'}
      </Button>
      {bank && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="tap link-ios text-ink-muted hover:text-primary-ink text-xs font-medium underline underline-offset-2"
        >
          Remover
        </button>
      )}

      <AccountIconPicker
        open={open}
        value={value}
        accountName={accountName}
        onPick={(slug) => {
          onChange(slug);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

import type { ReactNode } from 'react';
import { useId } from 'react';

import { setTheme, useTheme, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Tema claro',
    icon: (
      <>
        <circle cx="8" cy="8" r="3.2" />
        <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Tema escuro',
    icon: <path d="M13.4 9.9A5.9 5.9 0 0 1 6.1 2.6 5.9 5.9 0 1 0 13.4 9.9z" />,
  },
  {
    value: 'system',
    label: 'Acompanhar o sistema',
    icon: (
      <>
        <rect x="1.6" y="2.4" width="12.8" height="9" rx="1.4" />
        <path d="M5.6 14h4.8M8 11.4V14" />
      </>
    ),
  },
];

export function ThemeToggle() {
  const preference = useTheme();
  const name = useId();

  return (

    <fieldset className="border-border flex items-center gap-0.5 rounded-full border p-0.5">
      <legend className="sr-only">Tema da interface</legend>

      {OPTIONS.map((option) => (
        <label
          key={option.value}
          title={option.label}
          className="tap cursor-pointer"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={preference === option.value}
            onChange={() => setTheme(option.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{option.label}</span>
          <span
            aria-hidden="true"
            className="text-ink-muted peer-checked:bg-primary-soft peer-checked:text-primary-ink peer-focus-visible:outline-primary-ink hover:text-primary-ink flex size-7 items-center justify-center rounded-full transition-[background-color,color] duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {option.icon}
            </svg>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  note,
  status,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  note: ReactNode;
  status: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || still.matches) return;

    let box: DOMRect | null = null;

    function enter() {
      box = element!.getBoundingClientRect();
    }

    function move(event: PointerEvent) {
      box ??= element!.getBoundingClientRect();
      element!.style.setProperty('--nx', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
      element!.style.setProperty('--ny', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
    }

    function leave() {
      box = null;
      element!.style.setProperty('--nx', '0');
      element!.style.setProperty('--ny', '0');
    }

    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);

    return () => {
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
      <section className="press-bed relative flex flex-col items-center justify-center gap-7 px-4 py-9 sm:px-8 sm:py-12 lg:px-10">
        <div ref={stage} className="note-feed w-full max-w-[46rem] xl:max-w-[52rem]">
          <div className="note-sheet relative">
            {note}
            <div className="note-sheen pointer-events-none absolute inset-0 rounded-[10px]" />
          </div>
        </div>

        <div
          role="status"
          className="w-full max-w-[46rem] xl:max-w-[52rem] animate-rise"
          style={{ animationDelay: '520ms' }}
        >
          {status}
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[27rem]">
          <p
            className="font-serial text-primary-ink animate-rise text-[0.7rem] font-bold tracking-[0.4em] uppercase"
            style={{ animationDelay: '60ms' }}
          >
            {eyebrow}
          </p>

          <h1
            className="font-note text-ink animate-rise mt-4 text-[clamp(2.1rem,4.2vw,3rem)] leading-[1.03] font-semibold tracking-[-0.015em]"
            style={{ animationDelay: '120ms' }}
          >
            {title}
          </h1>

          <p
            className="text-ink-muted animate-rise mt-4 max-w-[38ch] leading-relaxed"
            style={{ animationDelay: '180ms' }}
          >
            {subtitle}
          </p>

          <div className="animate-rise mt-9" style={{ animationDelay: '240ms' }}>
            {children}
          </div>

          <div
            className="animate-rise mt-8 flex flex-wrap items-center justify-between gap-4"
            style={{ animationDelay: '300ms' }}
          >
            <div className="text-ink-muted text-sm">{footer}</div>
            <ThemeToggle />
          </div>
        </div>
      </section>
    </main>
  );
}

export function PressStatus({
  mark,
  headline,
  hint,
}: {
  mark: string;
  headline: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="font-serial text-press-ink border-press-muted/40 shrink-0 rounded-md border px-2.5 py-1 text-xs tracking-widest tabular-nums">
        {mark}
      </span>
      <div className="min-w-0">
        <p className="text-press-ink text-[0.95rem] font-medium">{headline}</p>
        <p className="text-press-muted mt-0.5 text-sm">{hint}</p>
      </div>
    </div>
  );
}

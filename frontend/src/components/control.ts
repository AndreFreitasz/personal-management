export type ControlSize = 'md' | 'lg';

export const CONTROL =
  'control-ios border-border-strong bg-surface text-ink w-full border placeholder:text-ink-muted hover:border-primary focus:border-primary';

export const CONTROL_SIZE: Record<ControlSize, string> = {
  md: 'rounded-lg px-3 py-2 text-sm',
  lg: 'rounded-xl px-4 py-3 text-base',
};

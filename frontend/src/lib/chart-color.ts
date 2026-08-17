const TARGET = {
  light: { l: 0.56, cMin: 0.12, cMax: 0.19 },
  dark: { l: 0.64, cMin: 0.12, cMax: 0.17 },
} as const;

export const CATEGORY_ORDER = [
  'Alimentação',
  'Lazer',
  'Transporte',
  'Moradia',
  'Investimento',
  'Salário',
] as const;

export const NEUTRAL_INK = { light: '#8a8f98', dark: '#767b83' } as const;

const s2lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin2s = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  const [r, g, b] = [0, 2, 4].map((i) => s2lin(parseInt(value.slice(i, i + 2), 16) / 255));
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return { l, c: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0001 && c <= 1.0001);

function oklchToHex(l: number, c: number, h: number): string {
  let lo = 0;
  let hi = c;
  if (inGamut(oklchToLinear(l, c, h))) lo = c;

  for (let i = 0; i < 24 && hi - lo > 0.0005; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
    else hi = mid;
  }

  return `#${oklchToLinear(l, lo, h)
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, lin2s(Math.min(1, Math.max(0, channel))))) * 255),
    )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function chartInk(color: string | null | undefined, dark: boolean): string {
  const mode = dark ? 'dark' : 'light';
  if (!color) return NEUTRAL_INK[mode];

  const source = hexToOklch(color);
  if (!source) return NEUTRAL_INK[mode];

  const target = TARGET[mode];
  return oklchToHex(target.l, Math.min(target.cMax, Math.max(target.cMin, source.c)), source.h);
}

const RAMP = {
  light: { strong: 0.44, weak: 0.62 },
  dark: { strong: 0.67, weak: 0.56 },
} as const;

export const MAX_CHILDREN = 5;

export function chartInkRamp(
  color: string | null | undefined,
  dark: boolean,
  count: number,
): string[] {
  const mode = dark ? 'dark' : 'light';
  const base = chartInk(color, dark);
  if (count <= 1) return [base];

  const chosen = color ? hexToOklch(color) : null;
  const source = chosen ?? hexToOklch(NEUTRAL_INK[mode]);
  if (!source) return Array.from({ length: count }, () => base);

  const target = TARGET[mode];
  const chroma = chosen
    ? Math.min(target.cMax, Math.max(target.cMin, chosen.c))
    : source.c;
  const { strong, weak } = RAMP[mode];

  return Array.from({ length: count }, (_, index) =>
    oklchToHex(strong + ((weak - strong) * index) / (count - 1), chroma, source.h),
  );
}

export function inCanonicalOrder<T extends { name: string; total: number }>(slices: T[]): T[] {
  const rank = (name: string) => {
    const index = CATEGORY_ORDER.indexOf(name as (typeof CATEGORY_ORDER)[number]);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };

  return [...slices].sort((a, b) => rank(a.name) - rank(b.name) || b.total - a.total);
}

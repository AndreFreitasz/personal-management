export type BankGroup = 'digital' | 'banco' | 'corretora' | 'pagamento' | 'outro';

export interface Bank {
  slug: string;
  name: string;
  bg: string;
  fg: string;
  mark: string;
  group: BankGroup;
}

export const BANK_GROUP_LABEL: Record<BankGroup, string> = {
  digital: 'Bancos digitais',
  banco: 'Bancos e cooperativas',
  corretora: 'Corretoras e investimentos',
  pagamento: 'Pagamentos e carteiras',
  outro: 'Sem marca',
};

export const BANKS: Bank[] = [
  { slug: 'nubank', name: 'Nubank', bg: '#820AD1', fg: '#FFFFFF', mark: 'N', group: 'digital' },
  { slug: 'inter', name: 'Inter', bg: '#FF7A00', fg: '#FFFFFF', mark: 'IN', group: 'digital' },
  { slug: 'c6', name: 'C6 Bank', bg: '#242424', fg: '#D9C08C', mark: 'C6', group: 'digital' },
  { slug: 'neon', name: 'Neon', bg: '#00A9E0', fg: '#052A38', mark: 'NE', group: 'digital' },
  { slug: 'next', name: 'next', bg: '#111111', fg: '#7BFF5C', mark: 'nx', group: 'digital' },
  { slug: 'will', name: 'Will Bank', bg: '#FFD100', fg: '#1A1A1A', mark: 'W', group: 'digital' },
  { slug: 'pan', name: 'Banco Pan', bg: '#00A0DF', fg: '#FFFFFF', mark: 'PN', group: 'digital' },
  { slug: 'bmg', name: 'Banco BMG', bg: '#F58220', fg: '#26221F', mark: 'BM', group: 'digital' },

  {
    slug: 'banco-do-brasil',
    name: 'Banco do Brasil',
    bg: '#FAE128',
    fg: '#0033A0',
    mark: 'BB',
    group: 'banco',
  },
  { slug: 'itau', name: 'Itaú', bg: '#EC7000', fg: '#00358E', mark: 'IT', group: 'banco' },
  { slug: 'bradesco', name: 'Bradesco', bg: '#CC092F', fg: '#FFFFFF', mark: 'BD', group: 'banco' },
  { slug: 'santander', name: 'Santander', bg: '#EC0000', fg: '#FFFFFF', mark: 'S', group: 'banco' },
  {
    slug: 'caixa',
    name: 'Caixa Econômica',
    bg: '#0070AF',
    fg: '#FFFFFF',
    mark: 'CX',
    group: 'banco',
  },
  { slug: 'safra', name: 'Banco Safra', bg: '#1B365D', fg: '#C9A227', mark: 'SF', group: 'banco' },
  { slug: 'brb', name: 'BRB', bg: '#004B8D', fg: '#FFFFFF', mark: 'BR', group: 'banco' },
  { slug: 'banrisul', name: 'Banrisul', bg: '#0067B1', fg: '#FFFFFF', mark: 'BS', group: 'banco' },
  { slug: 'sicredi', name: 'Sicredi', bg: '#3FA110', fg: '#FFFFFF', mark: 'SC', group: 'banco' },
  { slug: 'sicoob', name: 'Sicoob', bg: '#00AE9D', fg: '#043B36', mark: 'SB', group: 'banco' },
  {
    slug: 'original',
    name: 'Banco Original',
    bg: '#00A94F',
    fg: '#0B2B18',
    mark: 'OR',
    group: 'banco',
  },

  { slug: 'xp', name: 'XP Investimentos', bg: '#0F0F0F', fg: '#FFD100', mark: 'XP', group: 'corretora' },
  { slug: 'rico', name: 'Rico', bg: '#F5333F', fg: '#FFFFFF', mark: 'RI', group: 'corretora' },
  { slug: 'btg', name: 'BTG Pactual', bg: '#0A2240', fg: '#9BB7D4', mark: 'BT', group: 'corretora' },
  { slug: 'clear', name: 'Clear', bg: '#111827', fg: '#22D07A', mark: 'CL', group: 'corretora' },
  { slug: 'toro', name: 'Toro', bg: '#1B1F3B', fg: '#FF5A5F', mark: 'TR', group: 'corretora' },
  { slug: 'warren', name: 'Warren', bg: '#0E1C2F', fg: '#5AC8FA', mark: 'WR', group: 'corretora' },
  { slug: 'avenue', name: 'Avenue', bg: '#0B3C5D', fg: '#FFFFFF', mark: 'AV', group: 'corretora' },
  { slug: 'nomad', name: 'Nomad', bg: '#1A1A1A', fg: '#FFFFFF', mark: 'NM', group: 'corretora' },

  { slug: 'picpay', name: 'PicPay', bg: '#21C25E', fg: '#0A3D1F', mark: 'PP', group: 'pagamento' },
  {
    slug: 'mercado-pago',
    name: 'Mercado Pago',
    bg: '#009EE3',
    fg: '#FFFFFF',
    mark: 'MP',
    group: 'pagamento',
  },
  { slug: 'pagbank', name: 'PagBank', bg: '#00A868', fg: '#FFFFFF', mark: 'PB', group: 'pagamento' },
  { slug: 'stone', name: 'Stone', bg: '#0B7A4B', fg: '#FFFFFF', mark: 'ST', group: 'pagamento' },
  { slug: 'ame', name: 'Ame Digital', bg: '#E4007E', fg: '#FFFFFF', mark: 'AM', group: 'pagamento' },
  { slug: 'wise', name: 'Wise', bg: '#9FE870', fg: '#163300', mark: 'WI', group: 'pagamento' },

  { slug: 'dinheiro', name: 'Dinheiro vivo', bg: '#2E7D5B', fg: '#FFFFFF', mark: 'R$', group: 'outro' },
  { slug: 'cofre', name: 'Cofre / poupança', bg: '#4B5563', fg: '#FFFFFF', mark: 'CF', group: 'outro' },
  { slug: 'cartao', name: 'Cartão genérico', bg: '#334155', fg: '#FFFFFF', mark: '••', group: 'outro' },
  {
    slug: 'investimento',
    name: 'Investimento',
    bg: '#1F3A5F',
    fg: '#8FD3C7',
    mark: '↗',
    group: 'outro',
  },
];

const BY_SLUG = new Map(BANKS.map((bank) => [bank.slug, bank]));

export function bankOf(slug: string | null | undefined): Bank | null {
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

export const BANKS_BY_GROUP: Array<{ group: BankGroup; banks: Bank[] }> = (
  ['digital', 'banco', 'corretora', 'pagamento', 'outro'] as BankGroup[]
).map((group) => ({ group, banks: BANKS.filter((bank) => bank.group === group) }));

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

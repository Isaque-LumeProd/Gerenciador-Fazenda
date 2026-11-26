const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const formatarMoeda = (v: number) => moeda.format(v || 0);
export const formatarNumero = (v: number) => num.format(Number.isFinite(v) ? v : 0);
export const formatarNumero2 = (v: number) => num2.format(Number.isFinite(v) ? v : 0);
export const formatarPct = (v: number) => pct.format(Number.isFinite(v) ? v : 0);

export function gerarId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

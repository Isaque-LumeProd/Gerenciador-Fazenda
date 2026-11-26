const DIA_MS = 86_400_000;

/** Data de hoje em formato ISO (AAAA-MM-DD), no fuso local. */
export function hoje(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function somarDias(s: string, dias: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

/** Diferença em dias inteiros (b - a). */
export function diffDias(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DIA_MS);
}

export function idadeMeses(nascimento: string, referencia = hoje()): number {
  const n = parseISO(nascimento);
  const r = parseISO(referencia);
  let meses = (r.getFullYear() - n.getFullYear()) * 12 + (r.getMonth() - n.getMonth());
  if (r.getDate() < n.getDate()) meses -= 1;
  return Math.max(0, meses);
}

export function mesAno(s: string): string {
  return s.slice(0, 7);
}

export function formatarData(s?: string): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function rotuloMes(anoMes: string): string {
  const [y, m] = anoMes.split('-');
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
}

/** Lista os últimos `n` meses (AAAA-MM), do mais antigo ao atual. */
export function ultimosMeses(n: number, referencia = hoje()): string[] {
  const r = parseISO(referencia);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(r.getFullYear(), r.getMonth() - i, 1);
    out.push(toISO(d).slice(0, 7));
  }
  return out;
}

export function formatarIdade(meses: number): string {
  if (meses < 1) return '< 1 mês';
  if (meses < 24) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anos}a ${resto}m` : `${anos} anos`;
}

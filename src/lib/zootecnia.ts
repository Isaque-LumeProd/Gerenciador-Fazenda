// Regras de negócio e índices zootécnicos usados em todo o app.
import type {
  Bovino,
  EventoReprodutivo,
  LoteAves,
  Pesagem,
  RegistroAves,
  Sexo,
  FinalidadeBovino,
} from '@/types';
import { diffDias, hoje, idadeMeses, somarDias } from './datas';

/** Peso de referência de 1 Unidade Animal (UA). */
export const KG_POR_UA = 450;
/** Rendimento de carcaça padrão para estimar arrobas a partir do peso vivo. */
export const RENDIMENTO_CARCACA = 0.5;
/** 1 arroba = 15 kg de carcaça. */
export const KG_POR_ARROBA = 15;
/** Gestação média de bovinos, em dias. */
export const DIAS_GESTACAO = 283;

/* ---------------------------- Bovinos ---------------------------- */

export type CategoriaBovino =
  | 'bezerro'
  | 'bezerra'
  | 'garrote'
  | 'novilha'
  | 'boi'
  | 'touro'
  | 'vaca';

export function categoriaBovino(
  animal: Pick<Bovino, 'sexo' | 'dataNascimento' | 'finalidade'>,
  teveParto = false,
  referencia = hoje(),
): CategoriaBovino {
  const meses = idadeMeses(animal.dataNascimento, referencia);
  return categoriaPorIdade(animal.sexo, meses, animal.finalidade, teveParto);
}

export function categoriaPorIdade(
  sexo: Sexo,
  meses: number,
  finalidade: FinalidadeBovino,
  teveParto = false,
): CategoriaBovino {
  if (sexo === 'M') {
    if (meses < 12) return 'bezerro';
    if (meses < 24) return 'garrote';
    return finalidade === 'reprodução' ? 'touro' : 'boi';
  }
  if (meses < 12) return 'bezerra';
  if (teveParto || meses >= 36) return 'vaca';
  return 'novilha';
}

export function pesagensDoAnimal(pesagens: Pesagem[], bovinoId: string): Pesagem[] {
  return pesagens
    .filter((p) => p.bovinoId === bovinoId)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function pesoAtual(pesagens: Pesagem[], bovinoId: string): number | undefined {
  const lista = pesagensDoAnimal(pesagens, bovinoId);
  return lista.length ? lista[lista.length - 1].pesoKg : undefined;
}

/** Ganho Médio Diário (kg/dia) entre duas pesagens ordenadas. */
export function gmd(anterior: Pesagem, atual: Pesagem): number | undefined {
  const dias = diffDias(anterior.data, atual.data);
  if (dias <= 0) return undefined;
  return (atual.pesoKg - anterior.pesoKg) / dias;
}

/** GMD entre as duas últimas pesagens do animal. */
export function gmdRecente(pesagens: Pesagem[], bovinoId: string): number | undefined {
  const lista = pesagensDoAnimal(pesagens, bovinoId);
  if (lista.length < 2) return undefined;
  return gmd(lista[lista.length - 2], lista[lista.length - 1]);
}

export function arrobas(pesoVivoKg: number, rendimento = RENDIMENTO_CARCACA): number {
  return (pesoVivoKg * rendimento) / KG_POR_ARROBA;
}

export function unidadesAnimais(pesoKg: number): number {
  return pesoKg / KG_POR_UA;
}

/** Taxa de lotação (UA/ha). */
export function lotacao(totalUA: number, areaHa: number): number {
  return areaHa > 0 ? totalUA / areaHa : 0;
}

/* --------------------------- Reprodução -------------------------- */

export type StatusReprodutivo = 'vazia' | 'coberta' | 'prenhe' | 'parida';

export interface SituacaoReprodutiva {
  status: StatusReprodutivo;
  ultimaCobertura?: string;
  partoPrevisto?: string;
  ultimoParto?: string;
}

export function situacaoReprodutiva(
  eventos: EventoReprodutivo[],
  femeaId: string,
): SituacaoReprodutiva {
  const lista = eventos
    .filter((e) => e.femeaId === femeaId)
    .sort((a, b) => a.data.localeCompare(b.data));

  let sit: SituacaoReprodutiva = { status: 'vazia' };
  for (const ev of lista) {
    switch (ev.tipo) {
      case 'cobertura':
      case 'inseminação':
        sit = {
          ...sit,
          status: 'coberta',
          ultimaCobertura: ev.data,
          partoPrevisto: somarDias(ev.data, DIAS_GESTACAO),
        };
        break;
      case 'diagnóstico':
        if (ev.resultado === 'prenhe') sit = { ...sit, status: 'prenhe' };
        else sit = { ...sit, status: 'vazia', partoPrevisto: undefined };
        break;
      case 'parto':
        sit = { status: 'parida', ultimoParto: ev.data, ultimaCobertura: sit.ultimaCobertura };
        break;
      case 'aborto':
        sit = { ...sit, status: 'vazia', partoPrevisto: undefined };
        break;
    }
  }
  return sit;
}

/** Intervalo médio entre partos (dias) de uma fêmea. */
export function intervaloEntrePartos(eventos: EventoReprodutivo[], femeaId: string): number | undefined {
  const partos = eventos
    .filter((e) => e.femeaId === femeaId && e.tipo === 'parto')
    .map((e) => e.data)
    .sort();
  if (partos.length < 2) return undefined;
  let soma = 0;
  for (let i = 1; i < partos.length; i++) soma += diffDias(partos[i - 1], partos[i]);
  return soma / (partos.length - 1);
}

/* ----------------------------- Aves ------------------------------ */

export interface IndicesLote {
  avesVivas: number;
  mortesTotais: number;
  mortalidade: number;
  idadeDias: number;
  ovosTotais: number;
  racaoTotalKg: number;
  /** Taxa de postura média dos últimos 7 registros (ovos / ave / dia). */
  posturaRecente: number;
  /** kg de ração por dúzia de ovos (postura). */
  racaoPorDuzia: number;
  pesoMedioG?: number;
  /** Conversão alimentar (kg ração / kg de peso vivo produzido) — lotes de corte. */
  conversaoAlimentar?: number;
}

export function registrosDoLote(registros: RegistroAves[], loteId: string): RegistroAves[] {
  return registros
    .filter((r) => r.loteId === loteId)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function indicesLote(
  lote: LoteAves,
  registros: RegistroAves[],
  referencia = hoje(),
): IndicesLote {
  const lista = registrosDoLote(registros, lote.id);
  const mortesTotais = lista.reduce((s, r) => s + r.mortes, 0);
  const avesVivas = Math.max(0, lote.quantidadeInicial - mortesTotais);
  const ovosTotais = lista.reduce((s, r) => s + r.ovos, 0);
  const racaoTotalKg = lista.reduce((s, r) => s + r.racaoKg, 0);
  const fim = lote.status === 'encerrado' && lote.dataEncerramento ? lote.dataEncerramento : referencia;
  const idadeDias = lote.idadeInicialDias + Math.max(0, diffDias(lote.dataAlojamento, fim));

  // Postura recente: reconstrói as aves vivas em cada dia para não superestimar.
  let vivas = lote.quantidadeInicial;
  const taxas: number[] = [];
  for (const r of lista) {
    vivas -= r.mortes;
    if (vivas > 0) taxas.push(r.ovos / vivas);
  }
  const ultimas = taxas.slice(-7);
  const posturaRecente = ultimas.length ? ultimas.reduce((a, b) => a + b, 0) / ultimas.length : 0;

  const comPeso = lista.filter((r) => r.pesoMedioG);
  const pesoMedioG = comPeso.length ? comPeso[comPeso.length - 1].pesoMedioG : undefined;

  let conversaoAlimentar: number | undefined;
  if (lote.finalidade === 'corte' && pesoMedioG && avesVivas > 0) {
    const kgProduzidos = (pesoMedioG / 1000) * avesVivas;
    conversaoAlimentar = kgProduzidos > 0 ? racaoTotalKg / kgProduzidos : undefined;
  }

  return {
    avesVivas,
    mortesTotais,
    mortalidade: lote.quantidadeInicial ? mortesTotais / lote.quantidadeInicial : 0,
    idadeDias,
    ovosTotais,
    racaoTotalKg,
    posturaRecente,
    racaoPorDuzia: ovosTotais ? racaoTotalKg / (ovosTotais / 12) : 0,
    pesoMedioG,
    conversaoAlimentar,
  };
}

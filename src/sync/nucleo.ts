// Funções puras da sincronização (sem efeitos colaterais), testadas isoladamente.
import type { DadosFazenda, NomeColecao } from '@/types';
import { COLECOES_SYNC, type ColecaoSync, type Mudanca } from '../../shared/colecoes';
import { CONFIG_PADRAO } from '@/store/useFazenda';

/** Alterações locais ainda não enviadas: chave "colecao/id" → momento da alteração (ms). */
export type Pendentes = Record<string, number>;

export const chave = (colecao: string, id: string) => `${colecao}/${id}`;
export function separarChave(k: string): { colecao: ColecaoSync; id: string } {
  const i = k.indexOf('/');
  return { colecao: k.slice(0, i) as ColecaoSync, id: k.slice(i + 1) };
}

const COLECOES_DADOS = COLECOES_SYNC.filter((c) => c !== 'config') as NomeColecao[];

/**
 * Compara dois estados e devolve as chaves dos registros criados, alterados ou excluídos.
 * Como o estado é imutável, basta comparar referências — rápido mesmo com milhares de registros.
 */
export function detectarMudancas(antes: DadosFazenda, depois: DadosFazenda): string[] {
  const out: string[] = [];
  for (const c of COLECOES_DADOS) {
    const a = antes[c] as { id: string }[];
    const d = depois[c] as { id: string }[];
    if (a === d) continue;
    const anteriores = new Map(a.map((it) => [it.id, it]));
    for (const it of d) {
      if (anteriores.get(it.id) !== it) out.push(chave(c, it.id));
      anteriores.delete(it.id);
    }
    for (const id of anteriores.keys()) out.push(chave(c, id));
  }
  if (antes.config !== depois.config) out.push(chave('config', 'config'));
  return out;
}

/** Todas as chaves do estado (usado para enviar os dados existentes a uma conta nova). */
export function todasAsChaves(estado: DadosFazenda): string[] {
  const out = COLECOES_DADOS.flatMap((c) => (estado[c] as { id: string }[]).map((it) => chave(c, it.id)));
  out.push(chave('config', 'config'));
  return out;
}

/** Monta o lote de envio a partir do estado atual (registro ausente = exclusão). */
export function montarEnvio(estado: DadosFazenda, pendentes: Pendentes, limite: number): Mudanca[] {
  const indices = new Map<string, Map<string, unknown>>();
  const buscar = (colecao: ColecaoSync, id: string): Record<string, unknown> | null => {
    if (colecao === 'config') return { ...estado.config };
    let idx = indices.get(colecao);
    if (!idx) {
      idx = new Map((estado[colecao] as { id: string }[]).map((it) => [it.id, it]));
      indices.set(colecao, idx);
    }
    return (idx.get(id) as Record<string, unknown> | undefined) ?? null;
  };
  return Object.entries(pendentes)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limite)
    .map(([k, modificadoEm]) => {
      const { colecao, id } = separarChave(k);
      return { colecao, id, dados: buscar(colecao, id), modificadoEm };
    });
}

/**
 * Aplica alterações vindas do servidor. Uma alteração local pendente mais nova que a remota é preservada
 * (ela será enviada e vencerá no servidor); caso contrário a remota substitui e a pendência é descartada.
 */
export function aplicarRemotas(
  estado: DadosFazenda,
  mudancas: Mudanca[],
  pendentes: Pendentes,
): { patch: Partial<DadosFazenda>; descartar: string[] } {
  const descartar: string[] = [];
  const porColecao = new Map<ColecaoSync, Mudanca[]>();
  for (const m of mudancas) {
    const k = chave(m.colecao, m.id);
    const local = pendentes[k];
    if (local !== undefined && local > m.modificadoEm) continue;
    if (local !== undefined) descartar.push(k);
    const lista = porColecao.get(m.colecao) ?? [];
    lista.push(m);
    porColecao.set(m.colecao, lista);
  }

  const patch: Partial<DadosFazenda> = {};
  for (const [colecao, lista] of porColecao) {
    if (colecao === 'config') {
      const ultima = lista[lista.length - 1];
      if (ultima.dados) patch.config = { ...CONFIG_PADRAO, ...(ultima.dados as object) };
      continue;
    }
    const atual = estado[colecao] as { id: string }[];
    const mapa = new Map(atual.map((it) => [it.id, it]));
    for (const m of lista) {
      if (m.dados === null) mapa.delete(m.id);
      else mapa.set(m.id, { ...(m.dados as object), id: m.id });
    }
    (patch as Record<string, unknown>)[colecao] = [...mapa.values()];
  }
  return { patch, descartar };
}

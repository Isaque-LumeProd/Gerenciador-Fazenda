import { useMemo } from 'react';
import { useFazenda } from '@/store/useFazenda';
import type { Bovino } from '@/types';
import { idadeMeses } from './datas';
import {
  categoriaBovino,
  gmdRecente,
  pesoAtual,
  situacaoReprodutiva,
  type CategoriaBovino,
  type SituacaoReprodutiva,
} from './zootecnia';

export interface BovinoDerivado extends Bovino {
  idadeMeses: number;
  categoria: CategoriaBovino;
  peso?: number;
  gmd?: number;
  pastoNome?: string;
  reproducao?: SituacaoReprodutiva;
}

/** Bovinos enriquecidos com idade, categoria, peso atual, GMD e situação reprodutiva. */
export function useBovinosDerivados(): BovinoDerivado[] {
  const bovinos = useFazenda((s) => s.bovinos);
  const pesagens = useFazenda((s) => s.pesagens);
  const reproducao = useFazenda((s) => s.reproducao);
  const pastos = useFazenda((s) => s.pastos);

  return useMemo(() => {
    const nomePasto = new Map(pastos.map((p) => [p.id, p.nome]));
    const pariu = new Set(reproducao.filter((e) => e.tipo === 'parto').map((e) => e.femeaId));
    return bovinos.map((b) => ({
      ...b,
      idadeMeses: idadeMeses(b.dataNascimento, b.status === 'ativo' ? undefined : b.dataSaida),
      categoria: categoriaBovino(b, pariu.has(b.id)),
      peso: pesoAtual(pesagens, b.id),
      gmd: gmdRecente(pesagens, b.id),
      pastoNome: b.pastoId ? nomePasto.get(b.pastoId) : undefined,
      reproducao: b.sexo === 'F' ? situacaoReprodutiva(reproducao, b.id) : undefined,
    }));
  }, [bovinos, pesagens, reproducao, pastos]);
}

export function rotuloBovino(b?: Pick<Bovino, 'brinco' | 'nome'>): string {
  if (!b) return '—';
  return b.nome ? `${b.brinco} · ${b.nome}` : b.brinco;
}

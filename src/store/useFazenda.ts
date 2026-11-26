import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Colecoes,
  Configuracao,
  DadosFazenda,
  ItemDe,
  NomeColecao,
  MovimentoEstoque,
} from '@/types';
import { gerarId } from '@/lib/formato';
import { criarDadosDemo } from './seed';

export const CONFIG_PADRAO: Configuracao = {
  nomeEstancia: 'Minha Estância',
  proprietario: '',
  municipio: '',
  areaTotalHa: 0,
  precoArroba: 320,
  precoDuziaOvos: 9,
};

export const COLECOES_VAZIAS: Colecoes = {
  bovinos: [],
  pesagens: [],
  reproducao: [],
  leite: [],
  lotesAves: [],
  registrosAves: [],
  sanidade: [],
  pastos: [],
  estoque: [],
  movimentosEstoque: [],
  lancamentos: [],
  tarefas: [],
  funcionarios: [],
};

type SemId<T> = Omit<T, 'id'>;

interface Acoes {
  adicionar<K extends NomeColecao>(colecao: K, item: SemId<ItemDe<K>>): string;
  atualizar<K extends NomeColecao>(colecao: K, id: string, patch: Partial<ItemDe<K>>): void;
  remover<K extends NomeColecao>(colecao: K, id: string): void;
  /** Registra entrada/saída e ajusta o saldo do item em uma única operação. */
  movimentarEstoque(mov: SemId<MovimentoEstoque>): void;
  removerMovimento(id: string): void;
  atualizarConfig(patch: Partial<Configuracao>): void;
  importar(dados: DadosFazenda): void;
  carregarDemo(): void;
  limparTudo(): void;
}

export type EstadoFazenda = DadosFazenda & Acoes;

/** Remove registros que dependem de um item excluído (integridade referencial). */
function cascata(s: DadosFazenda, colecao: NomeColecao, id: string): Partial<DadosFazenda> {
  switch (colecao) {
    case 'bovinos':
      return {
        pesagens: s.pesagens.filter((p) => p.bovinoId !== id),
        reproducao: s.reproducao.filter((e) => e.femeaId !== id),
        sanidade: s.sanidade.filter((m) => !(m.alvo === 'animal' && m.alvoId === id)),
        bovinos: s.bovinos
          .filter((b) => b.id !== id)
          .map((b) => (b.maeId === id ? { ...b, maeId: undefined } : b)),
      };
    case 'lotesAves':
      return {
        registrosAves: s.registrosAves.filter((r) => r.loteId !== id),
        sanidade: s.sanidade.filter((m) => !(m.alvo === 'lote' && m.alvoId === id)),
      };
    case 'pastos':
      return {
        bovinos: s.bovinos.map((b) => (b.pastoId === id ? { ...b, pastoId: undefined } : b)),
      };
    case 'estoque':
      return { movimentosEstoque: s.movimentosEstoque.filter((m) => m.itemId !== id) };
    default:
      return {};
  }
}

export const useFazenda = create<EstadoFazenda>()(
  persist(
    (set) => ({
      ...COLECOES_VAZIAS,
      config: CONFIG_PADRAO,

      adicionar(colecao, item) {
        const id = gerarId();
        set((s) => ({ [colecao]: [...s[colecao], { ...item, id }] }) as Partial<EstadoFazenda>);
        return id;
      },

      atualizar(colecao, id, patch) {
        set(
          (s) =>
            ({
              [colecao]: (s[colecao] as { id: string }[]).map((it) =>
                it.id === id ? { ...it, ...patch } : it,
              ),
            }) as Partial<EstadoFazenda>,
        );
      },

      remover(colecao, id) {
        set((s) => {
          const extra = cascata(s, colecao, id);
          const base = (extra[colecao] as { id: string }[] | undefined) ??
            (s[colecao] as { id: string }[]);
          return { ...extra, [colecao]: base.filter((it) => it.id !== id) } as Partial<EstadoFazenda>;
        });
      },

      movimentarEstoque(mov) {
        set((s) => {
          const sinal = mov.tipo === 'entrada' ? 1 : -1;
          return {
            movimentosEstoque: [...s.movimentosEstoque, { ...mov, id: gerarId() }],
            estoque: s.estoque.map((it) =>
              it.id === mov.itemId
                ? { ...it, quantidade: Math.max(0, it.quantidade + sinal * mov.quantidade) }
                : it,
            ),
          };
        });
      },

      removerMovimento(id) {
        set((s) => {
          const mov = s.movimentosEstoque.find((m) => m.id === id);
          if (!mov) return {};
          const sinal = mov.tipo === 'entrada' ? -1 : 1; // desfaz o efeito
          return {
            movimentosEstoque: s.movimentosEstoque.filter((m) => m.id !== id),
            estoque: s.estoque.map((it) =>
              it.id === mov.itemId
                ? { ...it, quantidade: Math.max(0, it.quantidade + sinal * mov.quantidade) }
                : it,
            ),
          };
        });
      },

      atualizarConfig(patch) {
        set((s) => ({ config: { ...s.config, ...patch } }));
      },

      importar(dados) {
        set({ ...COLECOES_VAZIAS, ...dados, config: { ...CONFIG_PADRAO, ...dados.config } });
      },

      carregarDemo() {
        set(criarDadosDemo());
      },

      limparTudo() {
        set({ ...COLECOES_VAZIAS, config: CONFIG_PADRAO });
      },
    }),
    {
      name: 'gerenciador-fazenda:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Snapshot apenas dos dados (sem funções), usado no backup. */
export function exportarDados(s: EstadoFazenda): DadosFazenda {
  const { config } = s;
  const out = { config } as DadosFazenda;
  for (const k of Object.keys(COLECOES_VAZIAS) as NomeColecao[]) {
    (out as unknown as Record<string, unknown>)[k] = s[k];
  }
  return out;
}

// Compartilhado entre o app (navegador) e o servidor (Netlify Functions).

/** Coleções sincronizadas com o banco. `config` guarda um único registro com id "config". */
export const COLECOES_SYNC = [
  'bovinos',
  'pesagens',
  'reproducao',
  'leite',
  'lotesAves',
  'registrosAves',
  'sanidade',
  'pastos',
  'estoque',
  'movimentosEstoque',
  'lancamentos',
  'tarefas',
  'funcionarios',
  'config',
] as const;

export type ColecaoSync = (typeof COLECOES_SYNC)[number];

/** Uma alteração de registro trafegando entre app e servidor. `dados: null` = exclusão. */
export interface Mudanca {
  colecao: ColecaoSync;
  id: string;
  dados: Record<string, unknown> | null;
  /** Momento da alteração (ms desde 1970), usado para "a última alteração vence". */
  modificadoEm: number;
}

export interface RequisicaoSync {
  /** Último `seq` recebido do servidor (0 na primeira sincronização). */
  cursor: number;
  mudancas: Mudanca[];
}

export interface RespostaSync {
  cursor: number;
  /** Alterações feitas por qualquer usuário depois do cursor (inclui as que acabaram de ser enviadas). */
  mudancas: Mudanca[];
  /** Há mais alterações a buscar: chame de novo com o novo cursor. */
  mais: boolean;
  /** Alterações enviadas que foram rejeitadas por existir versão mais nova no servidor (já com a versão vencedora). */
  rejeitadas: Mudanca[];
}

export type Papel = 'admin' | 'membro';

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
}

export interface FazendaPublica {
  id: string;
  nome: string;
}

export const LIMITE_MUDANCAS_POR_ENVIO = 500;
export const LIMITE_MUDANCAS_POR_BUSCA = 1000;

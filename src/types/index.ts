// Modelo de dados do Gerenciador da Estância.
// Todas as datas são strings ISO "AAAA-MM-DD".

export type ID = string;

/* ---------------------------- Bovinos ---------------------------- */

export type Sexo = 'M' | 'F';
export type StatusAnimal = 'ativo' | 'vendido' | 'morto';
export type FinalidadeBovino = 'corte' | 'leite' | 'reprodução';
export type OrigemAnimal = 'nascido' | 'comprado';

export interface Bovino {
  id: ID;
  brinco: string;
  nome?: string;
  raca: string;
  sexo: Sexo;
  dataNascimento: string;
  finalidade: FinalidadeBovino;
  origem: OrigemAnimal;
  maeId?: ID;
  pai?: string;
  pastoId?: ID;
  status: StatusAnimal;
  dataSaida?: string;
  motivoSaida?: string;
  observacoes?: string;
}

export interface Pesagem {
  id: ID;
  bovinoId: ID;
  data: string;
  pesoKg: number;
  observacoes?: string;
}

export type TipoEventoReprodutivo =
  | 'cobertura'
  | 'inseminação'
  | 'diagnóstico'
  | 'parto'
  | 'aborto';

export interface EventoReprodutivo {
  id: ID;
  femeaId: ID;
  tipo: TipoEventoReprodutivo;
  data: string;
  touro?: string;
  resultado?: 'prenhe' | 'vazia';
  bezerroId?: ID;
  observacoes?: string;
}

export interface ProducaoLeite {
  id: ID;
  data: string;
  litros: number;
  vacasOrdenhadas: number;
  observacoes?: string;
}

/* ----------------------------- Aves ------------------------------ */

export type FinalidadeAve = 'postura' | 'corte' | 'matrizes';

export interface LoteAves {
  id: ID;
  codigo: string;
  finalidade: FinalidadeAve;
  raca: string;
  galpao: string;
  dataAlojamento: string;
  idadeInicialDias: number;
  quantidadeInicial: number;
  status: 'ativo' | 'encerrado';
  dataEncerramento?: string;
  observacoes?: string;
}

/** Registro diário de um lote (produção, mortalidade e consumo). */
export interface RegistroAves {
  id: ID;
  loteId: ID;
  data: string;
  ovos: number;
  ovosDescarte: number;
  mortes: number;
  racaoKg: number;
  pesoMedioG?: number;
  observacoes?: string;
}

/* --------------------------- Sanidade ---------------------------- */

export type Especie = 'bovino' | 'ave';
export type TipoManejoSanitario =
  | 'vacina'
  | 'vermífugo'
  | 'medicamento'
  | 'exame'
  | 'outro';

export interface ManejoSanitario {
  id: ID;
  especie: Especie;
  /** 'animal' (um bovino), 'lote' (um lote de aves) ou 'rebanho' (todos). */
  alvo: 'animal' | 'lote' | 'rebanho';
  alvoId?: ID;
  tipo: TipoManejoSanitario;
  produto: string;
  dose?: string;
  data: string;
  proximaDose?: string;
  carenciaDias?: number;
  responsavel?: string;
  observacoes?: string;
}

/* --------------------------- Pastagens --------------------------- */

export type StatusPasto = 'em uso' | 'descanso' | 'reforma';

export interface Pasto {
  id: ID;
  nome: string;
  areaHa: number;
  forrageira: string;
  status: StatusPasto;
  observacoes?: string;
}

/* ---------------------------- Estoque ---------------------------- */

export type CategoriaEstoque =
  | 'ração'
  | 'sal mineral'
  | 'medicamento'
  | 'vacina'
  | 'combustível'
  | 'ferramenta'
  | 'outros';

export interface ItemEstoque {
  id: ID;
  nome: string;
  categoria: CategoriaEstoque;
  unidade: string;
  quantidade: number;
  estoqueMinimo: number;
  custoUnitario: number;
}

export interface MovimentoEstoque {
  id: ID;
  itemId: ID;
  tipo: 'entrada' | 'saída';
  quantidade: number;
  data: string;
  observacoes?: string;
}

/* --------------------------- Financeiro -------------------------- */

export type Atividade = 'bovinos' | 'aves' | 'geral';

export interface Lancamento {
  id: ID;
  tipo: 'receita' | 'despesa';
  categoria: string;
  atividade: Atividade;
  descricao: string;
  valor: number;
  data: string;
  pago: boolean;
}

/* ---------------------------- Agenda ----------------------------- */

export interface Tarefa {
  id: ID;
  titulo: string;
  descricao?: string;
  data: string;
  prioridade: 'baixa' | 'média' | 'alta';
  area: Atividade | 'pastagens' | 'manutenção';
  responsavel?: string;
  concluida: boolean;
}

/* ------------------------- Funcionários -------------------------- */

export interface Funcionario {
  id: ID;
  nome: string;
  funcao: string;
  telefone?: string;
  dataAdmissao: string;
  salario: number;
  ativo: boolean;
}

/* ------------------------- Configuração -------------------------- */

export interface Configuracao {
  nomeEstancia: string;
  proprietario: string;
  municipio: string;
  areaTotalHa: number;
  precoArroba: number;
  precoDuziaOvos: number;
}

export interface Colecoes {
  bovinos: Bovino[];
  pesagens: Pesagem[];
  reproducao: EventoReprodutivo[];
  leite: ProducaoLeite[];
  lotesAves: LoteAves[];
  registrosAves: RegistroAves[];
  sanidade: ManejoSanitario[];
  pastos: Pasto[];
  estoque: ItemEstoque[];
  movimentosEstoque: MovimentoEstoque[];
  lancamentos: Lancamento[];
  tarefas: Tarefa[];
  funcionarios: Funcionario[];
}

export type NomeColecao = keyof Colecoes;
export type ItemDe<K extends NomeColecao> = Colecoes[K][number];

export interface DadosFazenda extends Colecoes {
  config: Configuracao;
}

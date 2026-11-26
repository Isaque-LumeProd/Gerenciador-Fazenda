// Esquema dos registros sincronizados. O servidor usa para recusar dados malformados
// (que poderiam travar o app dos outros usuários) e o app usa para validar backups importados.
import type { ColecaoSync } from './colecoes';

type Tipo = 'texto' | 'numero' | 'booleano' | 'data' | 'id';

interface Campo {
  tipo: Tipo;
  obrigatorio?: boolean;
  opcoes?: readonly string[];
  /** Tamanho máximo do texto (padrão 200). */
  max?: number;
}

const texto = (obrigatorio = false, max = 200): Campo => ({ tipo: 'texto', obrigatorio, max });
const obs: Campo = { tipo: 'texto', max: 2000 };
const num = (obrigatorio = false): Campo => ({ tipo: 'numero', obrigatorio });
const data = (obrigatorio = false): Campo => ({ tipo: 'data', obrigatorio });
const ref = (obrigatorio = false): Campo => ({ tipo: 'id', obrigatorio });
const bool = (obrigatorio = false): Campo => ({ tipo: 'booleano', obrigatorio });
const opcao = (opcoes: readonly string[], obrigatorio = true): Campo => ({ tipo: 'texto', opcoes, obrigatorio });

export const ESQUEMA: Record<ColecaoSync, Record<string, Campo>> = {
  bovinos: {
    brinco: texto(true, 50), nome: texto(), raca: texto(true), sexo: opcao(['F', 'M']),
    dataNascimento: data(true), finalidade: opcao(['corte', 'leite', 'reprodução']), origem: opcao(['nascido', 'comprado']),
    maeId: ref(), pai: texto(), pastoId: ref(), status: opcao(['ativo', 'vendido', 'morto']),
    dataSaida: data(), motivoSaida: texto(), observacoes: obs,
  },
  pesagens: { bovinoId: ref(true), data: data(true), pesoKg: num(true), observacoes: obs },
  reproducao: {
    femeaId: ref(true), tipo: opcao(['cobertura', 'inseminação', 'diagnóstico', 'parto', 'aborto']), data: data(true),
    touro: texto(), resultado: opcao(['prenhe', 'vazia'], false), bezerroId: ref(), observacoes: obs,
  },
  leite: { data: data(true), litros: num(true), vacasOrdenhadas: num(true), observacoes: obs },
  lotesAves: {
    codigo: texto(true, 50), finalidade: opcao(['postura', 'corte', 'matrizes']), raca: texto(true), galpao: texto(true),
    dataAlojamento: data(true), idadeInicialDias: num(true), quantidadeInicial: num(true),
    status: opcao(['ativo', 'encerrado']), dataEncerramento: data(), observacoes: obs,
  },
  registrosAves: {
    loteId: ref(true), data: data(true), ovos: num(true), ovosDescarte: num(true), mortes: num(true), racaoKg: num(true),
    pesoMedioG: num(), observacoes: obs,
  },
  sanidade: {
    especie: opcao(['bovino', 'ave']), alvo: opcao(['animal', 'lote', 'rebanho']), alvoId: ref(),
    tipo: opcao(['vacina', 'vermífugo', 'medicamento', 'exame', 'outro']), produto: texto(true), dose: texto(),
    data: data(true), proximaDose: data(), carenciaDias: num(), responsavel: texto(), observacoes: obs,
  },
  pastos: { nome: texto(true), areaHa: num(true), forrageira: texto(true), status: opcao(['em uso', 'descanso', 'reforma']), observacoes: obs },
  estoque: {
    nome: texto(true), categoria: opcao(['ração', 'sal mineral', 'medicamento', 'vacina', 'combustível', 'ferramenta', 'outros']),
    unidade: texto(true, 50), quantidade: num(true), estoqueMinimo: num(true), custoUnitario: num(true),
  },
  movimentosEstoque: { itemId: ref(true), tipo: opcao(['entrada', 'saída']), quantidade: num(true), data: data(true), observacoes: obs },
  lancamentos: {
    tipo: opcao(['receita', 'despesa']), categoria: texto(true), atividade: opcao(['bovinos', 'aves', 'geral']),
    descricao: texto(true, 500), valor: num(true), data: data(true), pago: bool(true),
  },
  tarefas: {
    titulo: texto(true, 300), descricao: obs, data: data(true), prioridade: opcao(['baixa', 'média', 'alta']),
    area: opcao(['bovinos', 'aves', 'geral', 'pastagens', 'manutenção']), responsavel: texto(), concluida: bool(true),
  },
  funcionarios: {
    nome: texto(true), funcao: texto(true), telefone: texto(false, 50), dataAdmissao: data(true), salario: num(true), ativo: bool(true),
  },
  config: {
    nomeEstancia: texto(true), proprietario: texto(true), municipio: texto(true), areaTotalHa: num(true),
    precoArroba: num(true), precoDuziaOvos: num(true),
  },
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_NUMERO = 1e12;

/**
 * Confere um registro contra o esquema da coleção.
 * Devolve o registro só com os campos conhecidos (os demais são descartados) ou a lista de problemas.
 */
export function validarRegistro(
  colecao: ColecaoSync,
  id: string,
  dados: unknown,
): { ok: true; registro: Record<string, unknown> } | { ok: false; erros: string[] } {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return { ok: false, erros: ['registro não é um objeto'] };
  const entrada = dados as Record<string, unknown>;
  const campos = ESQUEMA[colecao];
  const erros: string[] = [];
  const saida: Record<string, unknown> = colecao === 'config' ? {} : { id };

  for (const [nome, def] of Object.entries(campos)) {
    const v = entrada[nome];
    if (v === undefined || v === null || (v === '' && !def.obrigatorio && def.tipo !== 'texto')) {
      if (def.obrigatorio) erros.push(`${nome}: obrigatório`);
      continue;
    }
    switch (def.tipo) {
      case 'texto':
      case 'id': {
        const max = def.tipo === 'id' ? 100 : def.max ?? 200;
        if (typeof v !== 'string') erros.push(`${nome}: deve ser texto`);
        else if (v.length > max) erros.push(`${nome}: texto muito longo`);
        else if (def.opcoes && !def.opcoes.includes(v)) erros.push(`${nome}: valor não permitido`);
        else if (def.obrigatorio && def.tipo === 'id' && !v) erros.push(`${nome}: obrigatório`);
        else saida[nome] = v;
        break;
      }
      case 'numero':
        if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > LIMITE_NUMERO) erros.push(`${nome}: número inválido`);
        else saida[nome] = v;
        break;
      case 'booleano':
        if (typeof v !== 'boolean') erros.push(`${nome}: deve ser verdadeiro ou falso`);
        else saida[nome] = v;
        break;
      case 'data':
        if (typeof v !== 'string' || !DATA.test(v) || Number.isNaN(Date.parse(v))) erros.push(`${nome}: data inválida`);
        else saida[nome] = v;
        break;
    }
  }
  if (entrada.id !== undefined && colecao !== 'config' && entrada.id !== id) erros.push('id: diferente do identificador do registro');
  return erros.length ? { ok: false, erros } : { ok: true, registro: saida };
}

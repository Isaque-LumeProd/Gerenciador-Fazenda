// Dados de demonstração gerados em relação à data atual.
import type {
  Bovino,
  DadosFazenda,
  EventoReprodutivo,
  Lancamento,
  LoteAves,
  ManejoSanitario,
  Pesagem,
  ProducaoLeite,
  RegistroAves,
} from '@/types';
import { hoje, somarDias } from '@/lib/datas';
import { gerarId } from '@/lib/formato';

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function criarDadosDemo(): DadosFazenda {
  const r = rng(42);
  const H = hoje();
  const d = (dias: number) => somarDias(H, dias);
  const entre = (a: number, b: number) => a + r() * (b - a);

  const pastos = [
    { id: gerarId(), nome: 'Invernada do Arroio', areaHa: 42, forrageira: 'Tifton 85', status: 'em uso' as const },
    { id: gerarId(), nome: 'Potreiro da Sede', areaHa: 12, forrageira: 'Campo nativo', status: 'em uso' as const },
    { id: gerarId(), nome: 'Piquete das Vacas', areaHa: 25, forrageira: 'Braquiária', status: 'em uso' as const },
    { id: gerarId(), nome: 'Coxilha Alta', areaHa: 38, forrageira: 'Azevém + aveia', status: 'descanso' as const },
    { id: gerarId(), nome: 'Banhado', areaHa: 18, forrageira: 'Campo nativo', status: 'reforma' as const },
  ];

  const racas = ['Angus', 'Hereford', 'Braford', 'Nelore', 'Brangus'];
  const bovinos: Bovino[] = [];
  const pesagens: Pesagem[] = [];
  const reproducao: EventoReprodutivo[] = [];

  // Vacas de cria
  const vacas: Bovino[] = [];
  for (let i = 0; i < 14; i++) {
    const v: Bovino = {
      id: gerarId(),
      brinco: String(100 + i),
      nome: ['Mimosa', 'Estrela', 'Pintada', 'Baia', 'Moura', 'Faceira', 'Serena', 'Chuva', 'Bonita', 'Malhada', 'Prenda', 'Garoa', 'Lua', 'Querência'][i],
      raca: racas[i % racas.length],
      sexo: 'F',
      dataNascimento: d(-Math.round(entre(3.2, 8) * 365)),
      finalidade: i < 3 ? 'leite' : 'reprodução',
      origem: i < 8 ? 'comprado' : 'nascido',
      pastoId: pastos[2].id,
      status: 'ativo',
    };
    vacas.push(v);
  }
  bovinos.push(...vacas);

  // Touros
  bovinos.push(
    { id: gerarId(), brinco: '01', nome: 'Patrão', raca: 'Angus', sexo: 'M', dataNascimento: d(-5 * 365), finalidade: 'reprodução', origem: 'comprado', pastoId: pastos[1].id, status: 'ativo' },
    { id: gerarId(), brinco: '02', nome: 'Tropeiro', raca: 'Hereford', sexo: 'M', dataNascimento: d(-4 * 365), finalidade: 'reprodução', origem: 'comprado', pastoId: pastos[1].id, status: 'ativo' },
  );

  // Eventos reprodutivos e bezerros
  vacas.forEach((v, i) => {
    if (v.finalidade === 'leite' && i === 0) return;
    const partoAnterior = d(-Math.round(entre(200, 420)));
    reproducao.push({ id: gerarId(), femeaId: v.id, tipo: 'parto', data: partoAnterior });
    if (i % 2 === 0) {
      const bezerro: Bovino = {
        id: gerarId(),
        brinco: String(300 + i),
        raca: v.raca,
        sexo: i % 4 === 0 ? 'M' : 'F',
        dataNascimento: partoAnterior,
        finalidade: 'corte',
        origem: 'nascido',
        maeId: v.id,
        pai: i % 3 === 0 ? 'Patrão' : 'Tropeiro',
        pastoId: pastos[2].id,
        status: 'ativo',
      };
      bovinos.push(bezerro);
      reproducao[reproducao.length - 1].bezerroId = bezerro.id;
    }
    if (i % 3 !== 2) {
      const cob = d(-Math.round(entre(60, 250)));
      reproducao.push({ id: gerarId(), femeaId: v.id, tipo: i % 2 ? 'inseminação' : 'cobertura', data: cob, touro: i % 2 ? 'Sêmen Angus CRV' : 'Patrão' });
      reproducao.push({ id: gerarId(), femeaId: v.id, tipo: 'diagnóstico', data: somarDias(cob, 45), resultado: i % 5 === 4 ? 'vazia' : 'prenhe' });
    }
  });

  // Novilhos de engorda
  for (let i = 0; i < 16; i++) {
    bovinos.push({
      id: gerarId(),
      brinco: String(500 + i),
      raca: racas[(i + 2) % racas.length],
      sexo: i < 11 ? 'M' : 'F',
      dataNascimento: d(-Math.round(entre(14, 26) * 30)),
      finalidade: 'corte',
      origem: i < 6 ? 'comprado' : 'nascido',
      pastoId: pastos[0].id,
      status: 'ativo',
    });
  }

  // Um vendido e um morto, para histórico
  bovinos.push(
    { id: gerarId(), brinco: '480', raca: 'Braford', sexo: 'M', dataNascimento: d(-760), finalidade: 'corte', origem: 'nascido', status: 'vendido', dataSaida: d(-40), motivoSaida: 'Venda para frigorífico' },
    { id: gerarId(), brinco: '481', raca: 'Angus', sexo: 'M', dataNascimento: d(-500), finalidade: 'corte', origem: 'nascido', status: 'morto', dataSaida: d(-75), motivoSaida: 'Tristeza parasitária' },
  );

  // Pesagens trimestrais para os animais ativos
  for (const b of bovinos.filter((x) => x.status === 'ativo')) {
    // Curva simples: 35 kg ao nascer + ~0,6–0,8 kg/dia, limitada ao peso adulto do animal.
    const adulto = b.sexo === 'M' ? entre(520, 620) : entre(440, 540);
    const ritmo = entre(0.6, 0.8);
    for (const off of [-270, -180, -90, -10]) {
      const data = d(off + Math.round(entre(-3, 3)));
      if (data <= b.dataNascimento) continue;
      const idadeDias = (new Date(data).getTime() - new Date(b.dataNascimento).getTime()) / 86_400_000;
      const peso = Math.min(adulto, 35 + idadeDias * ritmo) * entre(0.97, 1.03);
      pesagens.push({ id: gerarId(), bovinoId: b.id, data, pesoKg: Math.round(peso) });
    }
  }

  // Produção de leite (30 dias)
  const leite: ProducaoLeite[] = [];
  for (let i = 30; i >= 1; i--) {
    leite.push({ id: gerarId(), data: d(-i), litros: Math.round(entre(38, 52)), vacasOrdenhadas: 3 });
  }

  // Aves
  const lotesAves: LoteAves[] = [
    { id: gerarId(), codigo: 'POST-01', finalidade: 'postura', raca: 'Embrapa 051', galpao: 'Galpão 1', dataAlojamento: d(-180), idadeInicialDias: 120, quantidadeInicial: 300, status: 'ativo' },
    { id: gerarId(), codigo: 'CAIP-02', finalidade: 'postura', raca: 'Caipira Pescoço Pelado', galpao: 'Galpão 2', dataAlojamento: d(-95), idadeInicialDias: 140, quantidadeInicial: 180, status: 'ativo' },
    { id: gerarId(), codigo: 'CORTE-03', finalidade: 'corte', raca: 'Label Rouge', galpao: 'Galpão 3', dataAlojamento: d(-52), idadeInicialDias: 1, quantidadeInicial: 250, status: 'ativo' },
  ];
  const registrosAves: RegistroAves[] = [];
  for (const lote of lotesAves) {
    let vivas = lote.quantidadeInicial;
    for (let i = 45; i >= 1; i--) {
      const data = d(-i);
      if (data < lote.dataAlojamento) continue;
      const mortes = r() < 0.18 ? 1 + Math.floor(r() * 2) : 0;
      vivas -= mortes;
      const taxa = lote.finalidade === 'postura' ? (lote.codigo === 'POST-01' ? entre(0.78, 0.88) : entre(0.55, 0.68)) : 0;
      const ovos = Math.round(vivas * taxa);
      const idade = lote.idadeInicialDias + (45 - i) + 7;
      registrosAves.push({
        id: gerarId(),
        loteId: lote.id,
        data,
        ovos,
        ovosDescarte: lote.finalidade === 'postura' ? Math.round(ovos * entre(0.01, 0.04)) : 0,
        mortes,
        racaoKg: Math.round(vivas * (lote.finalidade === 'corte' ? Math.min(0.16, 0.02 + idade * 0.0025) : 0.11) * 10) / 10,
        pesoMedioG: lote.finalidade === 'corte' && i % 7 === 0 ? Math.round(40 + idade * 42) : undefined,
      });
    }
  }

  // Sanidade
  const sanidade: ManejoSanitario[] = [
    { id: gerarId(), especie: 'bovino', alvo: 'rebanho', tipo: 'vacina', produto: 'Febre Aftosa', dose: '2 ml', data: d(-170), proximaDose: d(10), responsavel: 'Veterinário' },
    { id: gerarId(), especie: 'bovino', alvo: 'rebanho', tipo: 'vacina', produto: 'Clostridioses (Polivalente)', dose: '5 ml', data: d(-360), proximaDose: d(5), responsavel: 'João' },
    { id: gerarId(), especie: 'bovino', alvo: 'rebanho', tipo: 'vermífugo', produto: 'Ivermectina 1%', dose: '1 ml / 50 kg', data: d(-95), proximaDose: d(-5), carenciaDias: 35, responsavel: 'João' },
    { id: gerarId(), especie: 'bovino', alvo: 'animal', alvoId: vacas[3].id, tipo: 'medicamento', produto: 'Oxitetraciclina', dose: '20 ml', data: d(-12), carenciaDias: 28, observacoes: 'Pododermatite' },
    { id: gerarId(), especie: 'ave', alvo: 'lote', alvoId: lotesAves[2].id, tipo: 'vacina', produto: 'Newcastle + Bronquite', dose: 'Ocular', data: d(-38), proximaDose: d(3) },
    { id: gerarId(), especie: 'ave', alvo: 'lote', alvoId: lotesAves[0].id, tipo: 'vermífugo', produto: 'Levamisol (água)', data: d(-60), proximaDose: d(30) },
    { id: gerarId(), especie: 'ave', alvo: 'rebanho', tipo: 'exame', produto: 'Sorologia Salmonella', data: d(-20) },
  ];

  // Estoque
  const estoque = [
    { id: gerarId(), nome: 'Ração postura', categoria: 'ração' as const, unidade: 'kg', quantidade: 850, estoqueMinimo: 500, custoUnitario: 2.1 },
    { id: gerarId(), nome: 'Ração frango crescimento', categoria: 'ração' as const, unidade: 'kg', quantidade: 180, estoqueMinimo: 300, custoUnitario: 2.4 },
    { id: gerarId(), nome: 'Sal mineral 80P', categoria: 'sal mineral' as const, unidade: 'saco 25kg', quantidade: 14, estoqueMinimo: 6, custoUnitario: 145 },
    { id: gerarId(), nome: 'Vacina Aftosa', categoria: 'vacina' as const, unidade: 'dose', quantidade: 20, estoqueMinimo: 50, custoUnitario: 2.3 },
    { id: gerarId(), nome: 'Ivermectina 1% 500ml', categoria: 'medicamento' as const, unidade: 'frasco', quantidade: 3, estoqueMinimo: 2, custoUnitario: 89 },
    { id: gerarId(), nome: 'Óleo diesel', categoria: 'combustível' as const, unidade: 'L', quantidade: 320, estoqueMinimo: 200, custoUnitario: 6.2 },
    { id: gerarId(), nome: 'Milho em grão', categoria: 'ração' as const, unidade: 'saco 60kg', quantidade: 22, estoqueMinimo: 10, custoUnitario: 68 },
  ];
  const movimentosEstoque = [
    { id: gerarId(), itemId: estoque[0].id, tipo: 'entrada' as const, quantidade: 1000, data: d(-20), observacoes: 'NF 1234' },
    { id: gerarId(), itemId: estoque[0].id, tipo: 'saída' as const, quantidade: 150, data: d(-5) },
    { id: gerarId(), itemId: estoque[2].id, tipo: 'entrada' as const, quantidade: 20, data: d(-60) },
    { id: gerarId(), itemId: estoque[2].id, tipo: 'saída' as const, quantidade: 6, data: d(-15) },
  ];

  // Financeiro (12 meses)
  const lancamentos: Lancamento[] = [];
  const add = (l: Omit<Lancamento, 'id'>) => lancamentos.push({ ...l, id: gerarId() });
  for (let m = 11; m >= 0; m--) {
    const dia = (n: number) => d(-m * 30 - n);
    add({ tipo: 'receita', categoria: 'Venda de ovos', atividade: 'aves', descricao: 'Ovos — feira e mercado', valor: Math.round(entre(2800, 3900)), data: dia(2), pago: true });
    add({ tipo: 'receita', categoria: 'Venda de leite', atividade: 'bovinos', descricao: 'Leite — laticínio', valor: Math.round(entre(1900, 2600)), data: dia(5), pago: m > 0 });
    add({ tipo: 'despesa', categoria: 'Ração', atividade: 'aves', descricao: 'Ração das aves', valor: Math.round(entre(1700, 2300)), data: dia(8), pago: true });
    add({ tipo: 'despesa', categoria: 'Mão de obra', atividade: 'geral', descricao: 'Folha de pagamento', valor: 4800, data: dia(1), pago: m > 0 });
    add({ tipo: 'despesa', categoria: 'Sal mineral', atividade: 'bovinos', descricao: 'Sal mineral', valor: Math.round(entre(500, 900)), data: dia(12), pago: true });
    if (m % 3 === 0) add({ tipo: 'receita', categoria: 'Venda de gado', atividade: 'bovinos', descricao: 'Lote de novilhos', valor: Math.round(entre(14000, 26000)), data: dia(18), pago: true });
    if (m % 4 === 1) add({ tipo: 'despesa', categoria: 'Sanidade', atividade: 'bovinos', descricao: 'Vacinas e vermífugos', valor: Math.round(entre(600, 1400)), data: dia(20), pago: true });
    if (m % 2 === 0) add({ tipo: 'despesa', categoria: 'Combustível', atividade: 'geral', descricao: 'Diesel trator', valor: Math.round(entre(700, 1200)), data: dia(22), pago: true });
    if (m % 6 === 2) add({ tipo: 'despesa', categoria: 'Manutenção', atividade: 'geral', descricao: 'Cercas e bebedouros', valor: Math.round(entre(1500, 3000)), data: dia(25), pago: true });
  }
  add({ tipo: 'despesa', categoria: 'Ração', atividade: 'aves', descricao: 'Ração frango — pedido', valor: 2600, data: d(8), pago: false });

  const tarefas = [
    { id: gerarId(), titulo: 'Vacinar rebanho contra aftosa', data: d(10), prioridade: 'alta' as const, area: 'bovinos' as const, responsavel: 'João', concluida: false },
    { id: gerarId(), titulo: 'Comprar vacina aftosa (estoque baixo)', data: d(2), prioridade: 'alta' as const, area: 'bovinos' as const, concluida: false },
    { id: gerarId(), titulo: 'Trocar cama do Galpão 3', data: d(-1), prioridade: 'média' as const, area: 'aves' as const, responsavel: 'Maria', concluida: false },
    { id: gerarId(), titulo: 'Rodízio: mover novilhos para Coxilha Alta', data: d(6), prioridade: 'média' as const, area: 'pastagens' as const, concluida: false },
    { id: gerarId(), titulo: 'Consertar cerca do Banhado', data: d(14), prioridade: 'baixa' as const, area: 'manutenção' as const, concluida: false },
    { id: gerarId(), titulo: 'Pesagem trimestral do gado', data: d(-10), prioridade: 'média' as const, area: 'bovinos' as const, concluida: true },
  ];

  const funcionarios = [
    { id: gerarId(), nome: 'João da Silva', funcao: 'Capataz', telefone: '(55) 99999-0001', dataAdmissao: d(-2100), salario: 2900, ativo: true },
    { id: gerarId(), nome: 'Maria Souza', funcao: 'Tratadora de aves', telefone: '(55) 99999-0002', dataAdmissao: d(-800), salario: 1900, ativo: true },
  ];

  return {
    config: {
      nomeEstancia: 'Estância Boa Vista',
      proprietario: '',
      municipio: '',
      areaTotalHa: 160,
      precoArroba: 320,
      precoDuziaOvos: 9,
    },
    bovinos,
    pesagens,
    reproducao,
    leite,
    lotesAves,
    registrosAves,
    sanidade,
    pastos,
    estoque,
    movimentosEstoque,
    lancamentos,
    tarefas,
    funcionarios,
  };
}

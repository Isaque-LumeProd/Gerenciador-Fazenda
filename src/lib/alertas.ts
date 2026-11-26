import type { DadosFazenda, ManejoSanitario } from '@/types';
import { diffDias, formatarData, hoje, somarDias } from './datas';
import { registrosDoLote, situacaoReprodutiva } from './zootecnia';

export type NivelAlerta = 'crítico' | 'atenção' | 'info';

export interface Alerta {
  id: string;
  nivel: NivelAlerta;
  area: 'Sanidade' | 'Reprodução' | 'Estoque' | 'Agenda' | 'Aves' | 'Financeiro';
  titulo: string;
  detalhe: string;
  link: string;
}

/** Manejos com próxima dose ainda pendente (não substituídos por aplicação posterior). */
export function manejosPendentes(sanidade: ManejoSanitario[]): ManejoSanitario[] {
  const chave = (m: ManejoSanitario) => `${m.especie}|${m.alvo}|${m.alvoId ?? ''}|${m.produto.toLowerCase()}`;
  const ultimo = new Map<string, ManejoSanitario>();
  for (const m of sanidade) {
    const atual = ultimo.get(chave(m));
    if (!atual || m.data > atual.data) ultimo.set(chave(m), m);
  }
  return [...ultimo.values()].filter((m) => m.proximaDose);
}

/** Animais/lotes em período de carência na data de referência. */
export function emCarencia(sanidade: ManejoSanitario[], ref = hoje()): ManejoSanitario[] {
  return sanidade.filter(
    (m) => m.carenciaDias && m.carenciaDias > 0 && somarDias(m.data, m.carenciaDias) >= ref,
  );
}

export function gerarAlertas(dados: DadosFazenda, ref = hoje()): Alerta[] {
  const alertas: Alerta[] = [];
  const nomeAlvo = (m: ManejoSanitario) => {
    if (m.alvo === 'rebanho') return m.especie === 'bovino' ? 'todo o rebanho' : 'todas as aves';
    if (m.alvo === 'animal') {
      const b = dados.bovinos.find((x) => x.id === m.alvoId);
      return b ? `brinco ${b.brinco}` : 'animal';
    }
    const l = dados.lotesAves.find((x) => x.id === m.alvoId);
    return l ? `lote ${l.codigo}` : 'lote';
  };

  for (const m of manejosPendentes(dados.sanidade)) {
    const dias = diffDias(ref, m.proximaDose!);
    if (dias > 15) continue;
    alertas.push({
      id: `san-${m.id}`,
      nivel: dias < 0 ? 'crítico' : dias <= 7 ? 'atenção' : 'info',
      area: 'Sanidade',
      titulo: `${m.produto} — ${nomeAlvo(m)}`,
      detalhe: dias < 0 ? `Atrasada há ${-dias} dia(s)` : dias === 0 ? 'Vence hoje' : `Em ${dias} dia(s) (${formatarData(m.proximaDose)})`,
      link: '/sanidade',
    });
  }

  for (const vaca of dados.bovinos.filter((b) => b.sexo === 'F' && b.status === 'ativo')) {
    const sit = situacaoReprodutiva(dados.reproducao, vaca.id);
    if ((sit.status === 'prenhe' || sit.status === 'coberta') && sit.partoPrevisto) {
      const dias = diffDias(ref, sit.partoPrevisto);
      if (dias <= 30) {
        alertas.push({
          id: `parto-${vaca.id}`,
          nivel: dias < 0 ? 'atenção' : 'info',
          area: 'Reprodução',
          titulo: `Parto previsto — ${vaca.nome ?? 'brinco ' + vaca.brinco}`,
          detalhe: dias < 0 ? `Previsto há ${-dias} dia(s), registrar parto` : `Em ${dias} dia(s) (${formatarData(sit.partoPrevisto)})`,
          link: '/bovinos/reproducao',
        });
      }
    }
  }

  for (const item of dados.estoque) {
    if (item.quantidade <= item.estoqueMinimo) {
      alertas.push({
        id: `est-${item.id}`,
        nivel: item.quantidade === 0 ? 'crítico' : 'atenção',
        area: 'Estoque',
        titulo: `${item.nome} abaixo do mínimo`,
        detalhe: `${item.quantidade} ${item.unidade} (mínimo ${item.estoqueMinimo})`,
        link: '/estoque',
      });
    }
  }

  for (const t of dados.tarefas.filter((t) => !t.concluida)) {
    const dias = diffDias(ref, t.data);
    if (dias <= 0) {
      alertas.push({
        id: `tar-${t.id}`,
        nivel: dias < 0 ? 'atenção' : 'info',
        area: 'Agenda',
        titulo: t.titulo,
        detalhe: dias < 0 ? `Atrasada desde ${formatarData(t.data)}` : 'Para hoje',
        link: '/agenda',
      });
    }
  }

  for (const lote of dados.lotesAves.filter((l) => l.status === 'ativo')) {
    const regs = registrosDoLote(dados.registrosAves, lote.id).filter((r) => diffDias(r.data, ref) <= 7);
    const mortes = regs.reduce((s, r) => s + r.mortes, 0);
    const taxa = mortes / lote.quantidadeInicial;
    if (taxa > 0.02) {
      alertas.push({
        id: `mort-${lote.id}`,
        nivel: 'crítico',
        area: 'Aves',
        titulo: `Mortalidade alta no lote ${lote.codigo}`,
        detalhe: `${mortes} mortes nos últimos 7 dias`,
        link: `/aves/${lote.id}`,
      });
    }
    const ultimo = regs[regs.length - 1];
    if (!ultimo || diffDias(ultimo.data, ref) > 1) {
      alertas.push({
        id: `reg-${lote.id}`,
        nivel: 'info',
        area: 'Aves',
        titulo: `Lote ${lote.codigo} sem registro recente`,
        detalhe: ultimo ? `Último registro em ${formatarData(ultimo.data)}` : 'Nenhum registro na última semana',
        link: `/aves/${lote.id}`,
      });
    }
  }

  const vencidas = dados.lancamentos.filter((l) => l.tipo === 'despesa' && !l.pago && l.data <= ref);
  if (vencidas.length) {
    alertas.push({
      id: 'fin-vencidas',
      nivel: 'atenção',
      area: 'Financeiro',
      titulo: `${vencidas.length} conta(s) a pagar vencida(s)`,
      detalhe: 'Verifique os lançamentos pendentes',
      link: '/financeiro',
    });
  }

  const ordem: Record<NivelAlerta, number> = { crítico: 0, atenção: 1, info: 2 };
  return alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

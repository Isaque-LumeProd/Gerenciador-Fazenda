import { describe, expect, it } from 'vitest';
import { emCarencia, gerarAlertas, manejosPendentes } from '../alertas';
import type { DadosFazenda, ManejoSanitario } from '@/types';
import { COLECOES_VAZIAS, CONFIG_PADRAO } from '@/store/useFazenda';
import { criarDadosDemo } from '@/store/seed';

const vazio: DadosFazenda = { ...COLECOES_VAZIAS, config: CONFIG_PADRAO };

describe('alertas', () => {
  it('considera apenas a aplicação mais recente de cada produto', () => {
    const m = (id: string, data: string, proximaDose?: string): ManejoSanitario => ({ id, especie: 'bovino', alvo: 'rebanho', tipo: 'vacina', produto: 'Aftosa', data, proximaDose });
    const pend = manejosPendentes([m('1', '2025-05-01', '2025-11-01'), m('2', '2025-11-02', '2026-05-01')]);
    expect(pend.map((x) => x.id)).toEqual(['2']);
  });

  it('identifica carência ativa', () => {
    const m: ManejoSanitario = { id: '1', especie: 'bovino', alvo: 'animal', alvoId: 'a', tipo: 'medicamento', produto: 'X', data: '2026-01-01', carenciaDias: 10 };
    expect(emCarencia([m], '2026-01-11')).toHaveLength(1);
    expect(emCarencia([m], '2026-01-12')).toHaveLength(0);
  });

  it('alerta dose atrasada, estoque baixo e tarefa atrasada', () => {
    const dados: DadosFazenda = {
      ...vazio,
      sanidade: [{ id: 's', especie: 'bovino', alvo: 'rebanho', tipo: 'vacina', produto: 'Aftosa', data: '2025-06-01', proximaDose: '2026-01-01' }],
      estoque: [{ id: 'e', nome: 'Ração', categoria: 'ração', unidade: 'kg', quantidade: 0, estoqueMinimo: 100, custoUnitario: 2 }],
      tarefas: [{ id: 't', titulo: 'Cerca', data: '2026-01-05', prioridade: 'alta', area: 'manutenção', concluida: false }],
    };
    const a = gerarAlertas(dados, '2026-01-10');
    expect(a.map((x) => x.area).sort()).toEqual(['Agenda', 'Estoque', 'Sanidade']);
    expect(a.find((x) => x.area === 'Sanidade')!.nivel).toBe('crítico');
  });

  it('gera dados de demonstração consistentes', () => {
    const d = criarDadosDemo();
    const ids = new Set(d.bovinos.map((b) => b.id));
    expect(d.pesagens.every((p) => ids.has(p.bovinoId))).toBe(true);
    expect(d.reproducao.every((e) => ids.has(e.femeaId))).toBe(true);
    expect(() => gerarAlertas(d)).not.toThrow();
  });
});

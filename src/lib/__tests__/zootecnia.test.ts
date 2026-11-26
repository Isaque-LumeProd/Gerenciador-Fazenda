import { describe, expect, it } from 'vitest';
import {
  arrobas,
  categoriaPorIdade,
  gmd,
  gmdRecente,
  indicesLote,
  lotacao,
  situacaoReprodutiva,
  unidadesAnimais,
} from '../zootecnia';
import { diffDias, idadeMeses, somarDias } from '../datas';
import type { EventoReprodutivo, LoteAves, Pesagem, RegistroAves } from '@/types';

describe('datas', () => {
  it('soma dias atravessando meses', () => {
    expect(somarDias('2026-01-30', 3)).toBe('2026-02-02');
    expect(diffDias('2026-01-01', '2026-03-01')).toBe(59);
  });
  it('calcula idade em meses completos', () => {
    expect(idadeMeses('2025-01-15', '2026-01-14')).toBe(11);
    expect(idadeMeses('2025-01-15', '2026-01-15')).toBe(12);
  });
});

describe('bovinos', () => {
  it('classifica por sexo e idade', () => {
    expect(categoriaPorIdade('M', 6, 'corte')).toBe('bezerro');
    expect(categoriaPorIdade('M', 18, 'corte')).toBe('garrote');
    expect(categoriaPorIdade('M', 30, 'corte')).toBe('boi');
    expect(categoriaPorIdade('M', 30, 'reprodução')).toBe('touro');
    expect(categoriaPorIdade('F', 20, 'corte')).toBe('novilha');
    expect(categoriaPorIdade('F', 26, 'corte', true)).toBe('vaca');
    expect(categoriaPorIdade('F', 40, 'corte')).toBe('vaca');
  });

  it('calcula GMD, arrobas, UA e lotação', () => {
    const p: Pesagem[] = [
      { id: '1', bovinoId: 'a', data: '2026-01-01', pesoKg: 300 },
      { id: '2', bovinoId: 'a', data: '2026-04-11', pesoKg: 370 },
    ];
    expect(gmd(p[0], p[1])).toBeCloseTo(0.7);
    expect(gmdRecente([p[1], p[0]], 'a')).toBeCloseTo(0.7);
    expect(arrobas(450)).toBe(15);
    expect(unidadesAnimais(900)).toBe(2);
    expect(lotacao(10, 5)).toBe(2);
    expect(lotacao(10, 0)).toBe(0);
  });
});

describe('reprodução', () => {
  const ev = (tipo: EventoReprodutivo['tipo'], data: string, extra: Partial<EventoReprodutivo> = {}): EventoReprodutivo => ({ id: data + tipo, femeaId: 'v', tipo, data, ...extra });

  it('prevê parto 283 dias após a cobertura', () => {
    const s = situacaoReprodutiva([ev('cobertura', '2026-01-01')], 'v');
    expect(s.status).toBe('coberta');
    expect(s.partoPrevisto).toBe(somarDias('2026-01-01', 283));
  });

  it('segue o ciclo cobertura → diagnóstico → parto', () => {
    const eventos = [ev('parto', '2026-09-01'), ev('cobertura', '2025-11-20'), ev('diagnóstico', '2026-01-05', { resultado: 'prenhe' })];
    expect(situacaoReprodutiva(eventos.slice(1), 'v').status).toBe('prenhe');
    expect(situacaoReprodutiva(eventos, 'v').status).toBe('parida');
  });

  it('diagnóstico negativo volta para vazia', () => {
    const s = situacaoReprodutiva([ev('inseminação', '2026-01-01'), ev('diagnóstico', '2026-02-15', { resultado: 'vazia' })], 'v');
    expect(s.status).toBe('vazia');
    expect(s.partoPrevisto).toBeUndefined();
  });
});

describe('aves', () => {
  const lote: LoteAves = {
    id: 'l', codigo: 'L1', finalidade: 'postura', raca: 'x', galpao: 'g', dataAlojamento: '2026-01-01',
    idadeInicialDias: 120, quantidadeInicial: 100, status: 'ativo',
  };
  const reg = (data: string, ovos: number, mortes = 0): RegistroAves => ({ id: data, loteId: 'l', data, ovos, ovosDescarte: 0, mortes, racaoKg: 11 });

  it('desconta mortes e calcula postura sobre as aves vivas do dia', () => {
    const ind = indicesLote(lote, [reg('2026-01-02', 80), reg('2026-01-03', 72, 10)], '2026-01-11');
    expect(ind.avesVivas).toBe(90);
    expect(ind.mortalidade).toBeCloseTo(0.1);
    expect(ind.posturaRecente).toBeCloseTo((0.8 + 0.8) / 2);
    expect(ind.idadeDias).toBe(130);
    expect(ind.racaoPorDuzia).toBeCloseTo(22 / (152 / 12));
  });
});

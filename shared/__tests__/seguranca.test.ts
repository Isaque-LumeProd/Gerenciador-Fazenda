import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CABECALHOS_SEGURANCA } from '../cabecalhos';
import { validarRegistro } from '../esquema';
import { celulaCsv } from '../../src/lib/formato';

describe('cabeçalhos de segurança', () => {
  it('netlify.toml usa exatamente os mesmos cabeçalhos de shared/cabecalhos.ts', () => {
    const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) {
      expect(toml).toContain(`${nome} = "${valor}"`);
    }
  });

  it('a CSP não permite scripts externos nem embutidos', () => {
    const csp = CABECALHOS_SEGURANCA['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('esquema dos registros', () => {
  it('aceita registro válido e descarta campos desconhecidos', () => {
    const r = validarRegistro('pesagens', 'p1', { id: 'p1', bovinoId: 'b1', data: '2026-01-01', pesoKg: 300, extra: 'x' });
    expect(r).toEqual({ ok: true, registro: { id: 'p1', bovinoId: 'b1', data: '2026-01-01', pesoKg: 300 } });
  });

  it('recusa tipos errados, opções fora da lista e textos enormes', () => {
    expect(validarRegistro('pesagens', 'p1', { bovinoId: 'b1', data: '2026-01-01', pesoKg: '300' }).ok).toBe(false);
    expect(validarRegistro('lancamentos', 'l1', { tipo: 'roubo', categoria: 'x', atividade: 'geral', descricao: 'x', valor: 1, data: '2026-01-01', pago: true }).ok).toBe(false);
    expect(validarRegistro('tarefas', 't1', { titulo: 'x'.repeat(301), data: '2026-01-01', prioridade: 'alta', area: 'geral', concluida: false }).ok).toBe(false);
    expect(validarRegistro('leite', 'x', { data: '2026-01-01', litros: Infinity, vacasOrdenhadas: 1 }).ok).toBe(false);
    expect(validarRegistro('leite', 'x', ['lista']).ok).toBe(false);
  });
});

describe('exportação CSV', () => {
  it('neutraliza fórmulas e mantém números negativos', () => {
    expect(celulaCsv('=HYPERLINK("http://mal.example","clique")')).toBe('"\'=HYPERLINK(""http://mal.example"",""clique"")"');
    expect(celulaCsv('+5+cmd')).toBe('"\'+5+cmd"');
    expect(celulaCsv('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(celulaCsv('-0.110')).toBe('"-0.110"');
    expect(celulaCsv('Mimosa')).toBe('"Mimosa"');
  });
});

import { describe, expect, it } from 'vitest';
import { validarBackup } from '../backup';
import { criarDadosDemo } from '@/store/seed';

describe('validação de backup', () => {
  it('aceita o backup gerado pelo próprio app', () => {
    const r = validarBackup(JSON.parse(JSON.stringify(criarDadosDemo())));
    expect(r.ok).toBe(true);
  });

  it('recusa arquivo adulterado', () => {
    const d = JSON.parse(JSON.stringify(criarDadosDemo()));
    d.bovinos[0].brinco = { malicioso: true };
    d.lancamentos.push(d.lancamentos[0]); // id repetido
    const r = validarBackup(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.length).toBe(2);
  });

  it('recusa o que não é backup', () => {
    expect(validarBackup('texto').ok).toBe(false);
    expect(validarBackup({ bovinos: 'x' }).ok).toBe(false);
  });
});

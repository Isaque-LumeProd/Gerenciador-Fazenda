import { describe, expect, it } from 'vitest';
import { aplicarRemotas, detectarMudancas, montarEnvio } from '../nucleo';
import { COLECOES_VAZIAS, CONFIG_PADRAO } from '@/store/useFazenda';
import type { Bovino, DadosFazenda } from '@/types';

const boi = (id: string, brinco = id): Bovino => ({
  id, brinco, raca: 'Angus', sexo: 'M', dataNascimento: '2025-01-01', finalidade: 'corte', origem: 'nascido', status: 'ativo',
});
const base = (bovinos: Bovino[] = []): DadosFazenda => ({ ...COLECOES_VAZIAS, bovinos, config: CONFIG_PADRAO });

describe('detectarMudancas', () => {
  it('encontra criações, alterações e exclusões por referência', () => {
    const a = boi('a'), b = boi('b'), c = boi('c');
    const antes = base([a, b, c]);
    const depois = { ...antes, bovinos: [a, { ...b, brinco: 'X' }, boi('d')], config: { ...CONFIG_PADRAO, precoArroba: 1 } };
    expect(detectarMudancas(antes, depois).sort()).toEqual(['bovinos/b', 'bovinos/c', 'bovinos/d', 'config/config']);
  });

  it('ignora coleções não alteradas', () => {
    const e = base([boi('a')]);
    expect(detectarMudancas(e, { ...e })).toEqual([]);
  });
});

describe('montarEnvio', () => {
  it('envia o registro atual ou exclusão, dos mais antigos aos mais novos, respeitando o limite', () => {
    const e = base([boi('a')]);
    const envio = montarEnvio(e, { 'bovinos/sumiu': 5, 'bovinos/a': 3, 'config/config': 9 }, 2);
    expect(envio).toEqual([
      { colecao: 'bovinos', id: 'a', dados: boi('a'), modificadoEm: 3 },
      { colecao: 'bovinos', id: 'sumiu', dados: null, modificadoEm: 5 },
    ]);
  });
});

describe('aplicarRemotas', () => {
  it('insere, atualiza e exclui mantendo a ordem', () => {
    const e = base([boi('a'), boi('b')]);
    const { patch } = aplicarRemotas(
      e,
      [
        { colecao: 'bovinos', id: 'a', dados: { ...boi('a'), brinco: 'novo' } as never, modificadoEm: 10 },
        { colecao: 'bovinos', id: 'b', dados: null, modificadoEm: 10 },
        { colecao: 'bovinos', id: 'c', dados: boi('c') as never, modificadoEm: 10 },
      ],
      {},
    );
    expect(patch.bovinos!.map((x) => [x.id, x.brinco])).toEqual([['a', 'novo'], ['c', 'c']]);
  });

  it('preserva alteração local pendente mais nova e descarta a mais antiga', () => {
    const e = base([boi('a', 'local'), boi('b', 'local')]);
    const { patch, descartar } = aplicarRemotas(
      e,
      [
        { colecao: 'bovinos', id: 'a', dados: boi('a', 'remoto') as never, modificadoEm: 10 },
        { colecao: 'bovinos', id: 'b', dados: boi('b', 'remoto') as never, modificadoEm: 30 },
      ],
      { 'bovinos/a': 20, 'bovinos/b': 20 },
    );
    expect(patch.bovinos!.map((x) => x.brinco)).toEqual(['local', 'remoto']);
    expect(descartar).toEqual(['bovinos/b']);
  });

  it('mescla configuração com os padrões', () => {
    const { patch } = aplicarRemotas(base(), [{ colecao: 'config', id: 'config', dados: { nomeEstancia: 'Remota' }, modificadoEm: 1 }], {});
    expect(patch.config).toEqual({ ...CONFIG_PADRAO, nomeEstancia: 'Remota' });
  });
});

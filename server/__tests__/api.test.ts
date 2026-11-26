import { beforeEach, describe, expect, it } from 'vitest';
import { criarBancoLocal } from '../banco-local';
import { tratarRequisicao } from '../rotas';
import type { Banco } from '../banco';
import type { Mudanca, RespostaSync } from '../../shared/colecoes';

let db: Banco;

/** Cliente de teste que guarda o cookie de sessão como um navegador. */
function cliente() {
  let cookie = '';
  return async (metodo: string, caminho: string, corpo?: unknown) => {
    const res = await tratarRequisicao(
      new Request(`https://estancia.test/api${caminho}`, {
        method: metodo,
        headers: { ...(corpo ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      }),
      db,
    );
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, corpo: await res.json(), setCookie: set };
  };
}

const mud = (id: string, dados: Record<string, unknown> | null, modificadoEm: number, colecao: Mudanca['colecao'] = 'bovinos'): Mudanca => ({
  colecao, id, dados, modificadoEm,
});

async function criarEstancia() {
  const admin = cliente();
  const r = await admin('POST', '/cadastro', { nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'ana@x.com', senha: 'segredo123' });
  expect(r.status).toBe(201);
  return admin;
}

beforeEach(async () => {
  db = await criarBancoLocal(); // em memória, com as migrações aplicadas
});

describe('autenticação', () => {
  it('cria a estância uma única vez e define cookie seguro', async () => {
    const anon = cliente();
    expect((await anon('GET', '/estado')).corpo).toEqual({ inicializado: false });
    const admin = cliente();
    const r = await admin('POST', '/cadastro', { nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'Ana@X.com', senha: 'segredo123' });
    expect(r.status).toBe(201);
    expect(r.setCookie).toMatch(/HttpOnly/);
    expect(r.setCookie).toMatch(/Secure/);
    expect(r.corpo.usuario).toMatchObject({ email: 'ana@x.com', papel: 'admin' });
    expect((await anon('GET', '/estado')).corpo).toEqual({ inicializado: true });
    const outro = await cliente()('POST', '/cadastro', { nomeEstancia: 'Invasor', nome: 'X', email: 'x@x.com', senha: 'segredo123' });
    expect(outro.status).toBe(403);
  });

  it('login, sessão e logout', async () => {
    await criarEstancia();
    const c = cliente();
    expect((await c('GET', '/eu')).status).toBe(401);
    expect((await c('POST', '/login', { email: 'ana@x.com', senha: 'errada123' })).status).toBe(401);
    const ok = await c('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' });
    expect(ok.status).toBe(200);
    expect((await c('GET', '/eu')).corpo.fazenda.nome).toBe('Boa Vista');
    await c('POST', '/logout', {});
    expect((await c('GET', '/eu')).status).toBe(401);
  });

  it('rejeita requisições que não são JSON (proteção CSRF)', async () => {
    const admin = await criarEstancia();
    const r = await tratarRequisicao(new Request('https://estancia.test/api/login', { method: 'POST', body: 'email=a' }), db);
    expect(r.status).toBe(415);
    expect((await admin('GET', '/eu')).status).toBe(200);
  });

  it('admin cria membro; membro não gerencia usuários; usuário desativado perde acesso', async () => {
    const admin = await criarEstancia();
    const novo = await admin('POST', '/usuarios', { nome: 'João', email: 'joao@x.com', senha: 'peao12345', papel: 'membro' });
    expect(novo.status).toBe(201);
    const joao = cliente();
    expect((await joao('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' })).status).toBe(200);
    expect((await joao('GET', '/usuarios')).status).toBe(403);
    expect((await admin('PATCH', `/usuarios/${novo.corpo.id}`, { ativo: false })).status).toBe(200);
    expect((await joao('GET', '/eu')).status).toBe(401);
    expect((await joao('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' })).status).toBe(401);
  });
});

describe('sincronização', () => {
  it('envia, busca incrementalmente e propaga exclusões entre aparelhos', async () => {
    const a = await criarEstancia();
    await a('POST', '/usuarios', { nome: 'João', email: 'joao@x.com', senha: 'peao12345' });
    const b = cliente();
    await b('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' });

    const r1 = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { brinco: '10' }, 1000), mud('b2', { brinco: '11' }, 1000)] })).corpo as RespostaSync;
    expect(r1.mudancas).toHaveLength(2);

    const rb = (await b('POST', '/sync', { cursor: 0, mudancas: [] })).corpo as RespostaSync;
    expect(rb.mudancas.map((m) => m.id).sort()).toEqual(['b1', 'b2']);

    await a('POST', '/sync', { cursor: r1.cursor, mudancas: [mud('b1', null, 2000)] });
    const rb2 = (await b('POST', '/sync', { cursor: rb.cursor, mudancas: [] })).corpo as RespostaSync;
    expect(rb2.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: null, modificadoEm: 2000 }]);

    const rb3 = (await b('POST', '/sync', { cursor: rb2.cursor, mudancas: [] })).corpo as RespostaSync;
    expect(rb3.mudancas).toHaveLength(0);
  });

  it('a alteração mais recente vence e a perdedora volta como rejeitada', async () => {
    const a = await criarEstancia();
    await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { peso: 300 }, 5000)] });
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { peso: 250 }, 4000)] })).corpo as RespostaSync;
    expect(r.rejeitadas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: { peso: 300 }, modificadoEm: 5000 }]);
  });

  it('limita horários no futuro ao relógio do servidor', async () => {
    const a = await criarEstancia();
    const futuro = Date.now() + 365 * 86400_000;
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { x: 1 }, futuro)] })).corpo as RespostaSync;
    expect(r.mudancas[0].modificadoEm).toBeLessThanOrEqual(Date.now());
  });

  it('valida coleções e exige sessão', async () => {
    const a = await criarEstancia();
    expect((await a('POST', '/sync', { cursor: 0, mudancas: [mud('x', {}, 1, 'usuarios' as never)] })).status).toBe(400);
    expect((await cliente()('POST', '/sync', { cursor: 0, mudancas: [] })).status).toBe(401);
  });

  it('pagina buscas grandes', async () => {
    const a = await criarEstancia();
    for (let lote = 0; lote < 3; lote++) {
      const ms = Array.from({ length: 400 }, (_, i) => mud(`p${lote}-${i}`, { i }, 1000, 'pesagens'));
      await a('POST', '/sync', { cursor: 0, mudancas: ms });
    }
    const b = cliente();
    await b('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' });
    let cursor = 0;
    let total = 0;
    let paginas = 0;
    for (;;) {
      const r = (await b('POST', '/sync', { cursor, mudancas: [] })).corpo as RespostaSync;
      total += r.mudancas.length;
      cursor = r.cursor;
      paginas++;
      if (!r.mais) break;
    }
    expect(total).toBe(1200);
    expect(paginas).toBe(2);
  });
});

describe('sincronização em lote', () => {
  it('aceita o mesmo registro repetido no lote (fica a versão mais recente)', async () => {
    const a = await criarEstancia();
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { v: 2 }, 2000), mud('b1', { v: 1 }, 1000)] })).corpo as RespostaSync;
    expect(r.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: { v: 2 }, modificadoEm: 2000 }]);
  });

  it('isola os dados entre estâncias diferentes', async () => {
    const a = await criarEstancia();
    await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { segredo: true }, 1000)] });
    // Segunda estância criada direto no banco (o cadastro público só permite a primeira).
    const f = (await db.query<{ id: string }>(`INSERT INTO fazendas (nome) VALUES ('Outra') RETURNING id`)).rows[0];
    const { gerarHashSenha } = await import('../seguranca');
    await db.query(`INSERT INTO usuarios (fazenda_id, nome, email, senha_hash, papel) VALUES ($1, 'Zé', 'ze@y.com', $2, 'admin')`, [f.id, await gerarHashSenha('senhadoze1')]);
    const ze = cliente();
    await ze('POST', '/login', { email: 'ze@y.com', senha: 'senhadoze1' });
    const r = (await ze('POST', '/sync', { cursor: 0, mudancas: [mud('b1', { do: 'ze' }, 9000)] })).corpo as RespostaSync;
    expect(r.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: { do: 'ze' }, modificadoEm: 9000 }]);
    const ra = (await a('POST', '/sync', { cursor: 0, mudancas: [] })).corpo as RespostaSync;
    expect(ra.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: { segredo: true }, modificadoEm: 1000 }]);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { criarBancoLocal } from '../banco-local';
import { tratarRequisicao, type OpcoesApi } from '../rotas';
import { gerarHashSenha, verificarSenha } from '../seguranca';
import type { Banco } from '../banco';
import type { Mudanca, RespostaSync } from '../../shared/colecoes';

let db: Banco;

interface OpcoesCliente {
  ip?: string;
  origem?: string;
  api?: OpcoesApi;
}

/** Cliente de teste que guarda o cookie de sessão como um navegador. */
function cliente(op: OpcoesCliente = {}) {
  let cookie = '';
  return async (metodo: string, caminho: string, corpo?: unknown, headersExtra: Record<string, string> = {}) => {
    const res = await tratarRequisicao(
      new Request(`https://estancia.test/api${caminho}`, {
        method: metodo,
        headers: {
          ...(corpo ? { 'content-type': 'application/json' } : {}),
          ...(cookie ? { cookie } : {}),
          ...(op.ip ? { 'x-nf-client-connection-ip': op.ip } : {}),
          ...(op.origem ? { origin: op.origem } : {}),
          ...headersExtra,
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      }),
      db,
      op.api,
    );
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, corpo: await res.json(), setCookie: set, headers: res.headers };
  };
}

const boi = (brinco: string, extra: Record<string, unknown> = {}) => ({
  brinco, raca: 'Angus', sexo: 'M', dataNascimento: '2025-01-01', finalidade: 'corte', origem: 'nascido', status: 'ativo', ...extra,
});

const mud = (id: string, dados: Record<string, unknown> | null, modificadoEm: number, colecao: Mudanca['colecao'] = 'bovinos'): Mudanca => ({
  colecao, id, dados, modificadoEm,
});

/** Versão do registro como o servidor devolve (com o id incluído). */
const salvo = (id: string, dados: Record<string, unknown>) => ({ id, ...dados });

async function criarEstancia() {
  const admin = cliente();
  const r = await admin('POST', '/cadastro', { nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'ana@x.com', senha: 'segredo123' });
  expect(r.status).toBe(201);
  return admin;
}

async function criarMembro(admin: ReturnType<typeof cliente>) {
  await admin('POST', '/usuarios', { nome: 'João', email: 'joao@x.com', senha: 'peao12345' });
  const joao = cliente();
  expect((await joao('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' })).status).toBe(200);
  return joao;
}

beforeEach(async () => {
  db = await criarBancoLocal(); // em memória, com as migrações aplicadas
});

describe('autenticação', () => {
  it('cria a estância uma única vez e define cookie seguro', async () => {
    const anon = cliente();
    expect((await anon('GET', '/estado')).corpo).toEqual({ inicializado: false, exigeCodigo: false });
    const admin = cliente();
    const r = await admin('POST', '/cadastro', { nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'Ana@X.com', senha: 'segredo123' });
    expect(r.status).toBe(201);
    expect(r.setCookie).toMatch(/HttpOnly/);
    expect(r.setCookie).toMatch(/Secure/);
    expect(r.setCookie).toMatch(/SameSite=Lax/);
    expect(r.corpo.usuario).toMatchObject({ email: 'ana@x.com', papel: 'admin' });
    expect((await anon('GET', '/estado')).corpo.inicializado).toBe(true);
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

  it('admin cria membro; membro não gerencia usuários; usuário desativado perde acesso', async () => {
    const admin = await criarEstancia();
    const novo = await admin('POST', '/usuarios', { nome: 'João', email: 'joao@x.com', senha: 'peao12345', papel: 'membro' });
    expect(novo.status).toBe(201);
    const joao = cliente();
    expect((await joao('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' })).status).toBe(200);
    expect((await joao('GET', '/usuarios')).status).toBe(403);
    expect((await joao('POST', '/usuarios', { nome: 'Z', email: 'z@x.com', senha: 'zzzzzzzz', papel: 'admin' })).status).toBe(403);
    expect((await joao('PATCH', `/usuarios/${novo.corpo.id}`, { papel: 'admin' })).status).toBe(403);
    expect((await admin('PATCH', `/usuarios/${novo.corpo.id}`, { ativo: false })).status).toBe(200);
    expect((await joao('GET', '/eu')).status).toBe(401);
    expect((await joao('POST', '/login', { email: 'joao@x.com', senha: 'peao12345' })).status).toBe(401);
  });
});

describe('ataques bloqueados', () => {
  it('exige o código para criar a estância quando configurado', async () => {
    const api = { codigoCadastro: 'codigo-secreto-42' };
    const dados = { nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'ana@x.com', senha: 'segredo123' };
    expect((await cliente({ api })('GET', '/estado')).corpo.exigeCodigo).toBe(true);
    expect((await cliente({ api })('POST', '/cadastro', dados)).status).toBe(403);
    expect((await cliente({ api })('POST', '/cadastro', { ...dados, codigo: 'chute' })).status).toBe(403);
    expect((await cliente({ api })('POST', '/cadastro', { ...dados, codigo: 'codigo-secreto-42' })).status).toBe(201);
  });

  it('bloqueia o cadastro enquanto o código não estiver configurado no Netlify', async () => {
    const r = await cliente({ api: { codigoCadastro: null } })('POST', '/cadastro', {
      nomeEstancia: 'Boa Vista', nome: 'Ana', email: 'ana@x.com', senha: 'segredo123', codigo: '',
    });
    expect(r.status).toBe(403);
    expect(r.corpo.erro).toMatch(/CODIGO_CADASTRO/);
  });

  it('limita tentativas de adivinhar o código de cadastro', async () => {
    const api = { codigoCadastro: 'codigo-secreto-42' };
    const atacante = cliente({ api, ip: '203.0.113.9' });
    const dados = { nomeEstancia: 'X', nome: 'X', email: 'x@x.com', senha: 'segredo123' };
    for (let i = 0; i < 5; i++) await atacante('POST', '/cadastro', { ...dados, codigo: `chute-${i}` });
    expect((await atacante('POST', '/cadastro', { ...dados, codigo: 'codigo-secreto-42' })).status).toBe(429);
  });

  it('bloqueia força bruta de senha por e-mail, mesmo trocando de IP', async () => {
    await criarEstancia();
    for (let i = 0; i < 5; i++) {
      const r = await cliente({ ip: `198.51.100.${i}` })('POST', '/login', { email: 'ana@x.com', senha: `tentativa${i}` });
      expect(r.status).toBe(401);
    }
    const certa = await cliente({ ip: '198.51.100.99' })('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' });
    expect(certa.status).toBe(429);
  });

  it('bloqueia força bruta de um mesmo IP contra vários e-mails', async () => {
    await criarEstancia();
    const atacante = cliente({ ip: '192.0.2.50' });
    for (let i = 0; i < 30; i++) await atacante('POST', '/login', { email: `alvo${i}@x.com`, senha: 'qualquer123' });
    expect((await atacante('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' })).status).toBe(429);
    expect((await cliente({ ip: '192.0.2.51' })('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' })).status).toBe(200);
  });

  it('login certo zera as falhas daquele e-mail', async () => {
    await criarEstancia();
    for (let i = 0; i < 4; i++) await cliente()('POST', '/login', { email: 'ana@x.com', senha: `errada${i}x` });
    expect((await cliente()('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' })).status).toBe(200);
    for (let i = 0; i < 4; i++) await cliente()('POST', '/login', { email: 'ana@x.com', senha: `errada${i}y` });
    expect((await cliente()('POST', '/login', { email: 'ana@x.com', senha: 'segredo123' })).status).toBe(200);
  });

  it('recusa envio "simples" de outro site (CSRF) por tipo de conteúdo', async () => {
    await criarEstancia();
    for (const tipo of ['text/plain', 'text/plain; x=application/json', 'application/x-www-form-urlencoded']) {
      const r = await tratarRequisicao(
        new Request('https://estancia.test/api/login', { method: 'POST', headers: { 'content-type': tipo }, body: '{"email":"ana@x.com","senha":"segredo123"}' }),
        db,
      );
      expect(r.status).toBe(415);
    }
  });

  it('recusa alterações com Origin de outro site e aceita do próprio site', async () => {
    const admin = await criarEstancia();
    const r = await admin('POST', '/sync', { cursor: 0, mudancas: [] }, { origin: 'https://site-malicioso.example' });
    expect(r.status).toBe(403);
    expect((await admin('POST', '/sync', { cursor: 0, mudancas: [] }, { origin: 'https://estancia.test' })).status).toBe(200);
  });

  it('limita tentativas na troca de senha (sessão roubada não descobre a senha)', async () => {
    const admin = await criarEstancia();
    for (let i = 0; i < 5; i++) expect((await admin('POST', '/eu/senha', { senhaAtual: `chute${i}xx`, novaSenha: 'novasenha1' })).status).toBe(400);
    expect((await admin('POST', '/eu/senha', { senhaAtual: 'segredo123', novaSenha: 'novasenha1' })).status).toBe(429);
  });

  it('respostas da API não são guardadas em cache nem interpretadas como página', async () => {
    const r = await cliente()('GET', '/estado');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
  });
});

describe('senhas', () => {
  it('grava os parâmetros do scrypt e ainda aceita o formato antigo', async () => {
    const h = await gerarHashSenha('minhasenha');
    expect(h.split('$')).toHaveLength(6);
    expect(await verificarSenha('minhasenha', h)).toBe(true);
    expect(await verificarSenha('outrasenha', h)).toBe(false);
    const antigo = 'scrypt$' + '00'.repeat(16) + '$' + 'ab'.repeat(64);
    expect(await verificarSenha('x', antigo)).toBe(false);
    expect(await verificarSenha('x', 'scrypt$99999999$8$1$00$00')).toBe(false); // custo absurdo recusado
  });
});

describe('sincronização', () => {
  it('envia, busca incrementalmente e propaga exclusões entre aparelhos', async () => {
    const a = await criarEstancia();
    const b = await criarMembro(a);

    const r1 = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('10'), 1000), mud('b2', boi('11'), 1000)] })).corpo as RespostaSync;
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
    await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('300'), 5000)] });
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('250'), 4000)] })).corpo as RespostaSync;
    expect(r.rejeitadas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: salvo('b1', boi('300')), modificadoEm: 5000 }]);
  });

  it('limita horários no futuro ao relógio do servidor', async () => {
    const a = await criarEstancia();
    const futuro = Date.now() + 365 * 86400_000;
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('1'), futuro)] })).corpo as RespostaSync;
    expect(r.mudancas[0].modificadoEm).toBeLessThanOrEqual(Date.now());
  });

  it('valida coleções e exige sessão', async () => {
    const a = await criarEstancia();
    expect((await a('POST', '/sync', { cursor: 0, mudancas: [mud('x', {}, 1, 'usuarios' as never)] })).status).toBe(400);
    expect((await cliente()('POST', '/sync', { cursor: 0, mudancas: [] })).status).toBe(401);
  });

  it('recusa registros malformados sem travar o lote e descarta campos desconhecidos', async () => {
    const a = await criarEstancia();
    const r = (await a('POST', '/sync', {
      cursor: 0,
      mudancas: [
        mud('ok', boi('1', { campoEstranho: '<script>', idadeMeses: 3 }), 1000),
        mud('sem-brinco', boi('1', { brinco: undefined }), 1000),
        mud('tipo-errado', boi('1', { brinco: { $gt: '' } }), 1000),
        mud('opcao-invalida', boi('1', { sexo: 'X' }), 1000),
        mud('data-ruim', boi('1', { dataNascimento: '31/12/2025' }), 1000),
        mud('id-diferente', { ...boi('1'), id: 'outro' }, 1000),
        mud('peso-texto', { bovinoId: 'ok', data: '2026-01-01', pesoKg: '300' }, 1000, 'pesagens'),
        mud('config', null, 1000, 'config'),
      ],
    })).corpo as RespostaSync;
    expect(r.mudancas).toEqual([{ colecao: 'bovinos', id: 'ok', dados: salvo('ok', boi('1')), modificadoEm: 1000 }]);
    expect(r.invalidas!.map((x) => x.id).sort()).toEqual(
      ['config', 'data-ruim', 'id-diferente', 'opcao-invalida', 'peso-texto', 'sem-brinco', 'tipo-errado'].sort(),
    );
  });

  it('pagina buscas grandes', async () => {
    const a = await criarEstancia();
    for (let lote = 0; lote < 3; lote++) {
      const ms = Array.from({ length: 400 }, (_, i) => mud(`p${lote}-${i}`, { bovinoId: 'b1', data: '2026-01-01', pesoKg: i }, 1000, 'pesagens'));
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

  it('aceita o mesmo registro repetido no lote (fica a versão mais recente)', async () => {
    const a = await criarEstancia();
    const r = (await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('2'), 2000), mud('b1', boi('1'), 1000)] })).corpo as RespostaSync;
    expect(r.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: salvo('b1', boi('2')), modificadoEm: 2000 }]);
  });

  it('isola os dados entre estâncias diferentes', async () => {
    const a = await criarEstancia();
    await a('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('segredo'), 1000)] });
    // Segunda estância criada direto no banco (o cadastro público só permite a primeira).
    const f = (await db.query<{ id: string }>(`INSERT INTO fazendas (nome) VALUES ('Outra') RETURNING id`)).rows[0];
    await db.query(`INSERT INTO usuarios (fazenda_id, nome, email, senha_hash, papel) VALUES ($1, 'Zé', 'ze@y.com', $2, 'admin')`, [
      f.id, await gerarHashSenha('senhadoze1'),
    ]);
    const ze = cliente();
    await ze('POST', '/login', { email: 'ze@y.com', senha: 'senhadoze1' });
    const r = (await ze('POST', '/sync', { cursor: 0, mudancas: [mud('b1', boi('do-ze'), 9000)] })).corpo as RespostaSync;
    expect(r.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: salvo('b1', boi('do-ze')), modificadoEm: 9000 }]);
    const ra = (await a('POST', '/sync', { cursor: 0, mudancas: [] })).corpo as RespostaSync;
    expect(ra.mudancas).toEqual([{ colecao: 'bovinos', id: 'b1', dados: salvo('b1', boi('segredo')), modificadoEm: 1000 }]);
    // Zé apaga o b1 da estância dele e tenta restaurar/ler a lixeira: só enxerga o que é dele.
    await ze('POST', '/sync', { cursor: 0, mudancas: [mud('b1', null, 9500)] });
    const lixeiraZe = (await ze('GET', '/lixeira')).corpo;
    expect(lixeiraZe.map((x: { dados: { brinco: string } }) => x.dados.brinco)).toEqual(['do-ze']);
    expect((await a('GET', '/lixeira')).corpo).toEqual([]);
  });
});

describe('lixeira e histórico', () => {
  it('guarda versões anteriores e restaura registros apagados (inclusive apagamento em massa)', async () => {
    const admin = await criarEstancia();
    const joao = await criarMembro(admin);
    const bois = Array.from({ length: 20 }, (_, i) => mud(`b${i}`, boi(String(i)), 1000));
    await admin('POST', '/sync', { cursor: 0, mudancas: bois });
    await admin('POST', '/sync', { cursor: 0, mudancas: [mud('b0', boi('0', { nome: 'Mimosa' }), 1500)] });

    // Membro mal-intencionado apaga tudo.
    await joao('POST', '/sync', { cursor: 0, mudancas: bois.map((m) => mud(m.id, null, 2000)) });
    const hist = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM registros_historico`);
    expect(hist.rows[0].n).toBe(21); // 1 alteração + 20 exclusões

    expect((await joao('GET', '/lixeira')).status).toBe(403);
    expect((await joao('POST', '/lixeira/restaurar', { itens: [{ colecao: 'bovinos', id: 'b0' }] })).status).toBe(403);

    const lixeira = (await admin('GET', '/lixeira')).corpo;
    expect(lixeira).toHaveLength(20);
    const b0 = lixeira.find((x: { id: string }) => x.id === 'b0');
    expect(b0.dados.nome).toBe('Mimosa'); // última versão antes de apagar
    expect(b0.excluidoPor).toBe('João');

    const r = await admin('POST', '/lixeira/restaurar', { itens: lixeira.map((x: { colecao: string; id: string }) => ({ colecao: x.colecao, id: x.id })) });
    expect(r.corpo).toEqual({ restaurados: 20 });

    // O membro recebe tudo de volta na próxima sincronização.
    const volta = (await joao('POST', '/sync', { cursor: 0, mudancas: [] })).corpo as RespostaSync;
    expect(volta.mudancas.filter((m) => m.dados).length).toBe(20);
    expect((await admin('GET', '/lixeira')).corpo).toEqual([]);
  });
});

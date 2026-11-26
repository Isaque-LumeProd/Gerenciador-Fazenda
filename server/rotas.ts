// API do Gerenciador da Estância. Um único ponto de entrada (`/api/*`) usado pela
// Netlify Function e pelo servidor de desenvolvimento local.
import type { Banco, Cliente } from './banco';
import { gerarHashSenha, gerarToken, hashToken, verificarSenha } from './seguranca';
import {
  COLECOES_SYNC,
  LIMITE_MUDANCAS_POR_BUSCA,
  LIMITE_MUDANCAS_POR_ENVIO,
  type FazendaPublica,
  type Mudanca,
  type Papel,
  type RequisicaoSync,
  type RespostaSync,
  type UsuarioPublico,
} from '../shared/colecoes';

const COOKIE = 'sessao_estancia';
const DURACAO_SESSAO_DIAS = 90;
const TAMANHO_MAX_REGISTRO = 64 * 1024;
const COLECOES = new Set<string>(COLECOES_SYNC);

class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

interface Sessao {
  usuario: UsuarioPublico;
  fazenda: FazendaPublica;
}

const json = (dados: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

function cookieSessao(req: Request, token: string, maxAgeSeg: number): string {
  const seguro = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeg}${seguro}`;
}

function lerCookie(req: Request, nome: string): string | undefined {
  const cab = req.headers.get('cookie') ?? '';
  for (const parte of cab.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return undefined;
}

async function lerJson<T>(req: Request): Promise<T> {
  // Exigir JSON impede envios de formulários de outros sites (proteção contra CSRF junto com SameSite).
  if (!req.headers.get('content-type')?.includes('application/json')) throw new ErroHttp(415, 'Envie JSON.');
  try {
    return (await req.json()) as T;
  } catch {
    throw new ErroHttp(400, 'JSON inválido.');
  }
}

const texto = (v: unknown, campo: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new ErroHttp(400, `Campo obrigatório: ${campo}.`);
  if (v.length > max) throw new ErroHttp(400, `Campo muito longo: ${campo}.`);
  return v.trim();
};
const email = (v: unknown) => {
  const e = texto(v, 'e-mail', 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ErroHttp(400, 'E-mail inválido.');
  return e;
};
const senha = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 8) throw new ErroHttp(400, 'A senha deve ter ao menos 8 caracteres.');
  if (v.length > 200) throw new ErroHttp(400, 'Senha muito longa.');
  return v;
};

/* ----------------------------- Sessões ------------------------------ */

async function criarSessao(db: Cliente, usuarioId: string): Promise<string> {
  const token = gerarToken();
  await db.query(
    `INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [hashToken(token), usuarioId, String(DURACAO_SESSAO_DIAS)],
  );
  return token;
}

async function sessaoAtual(req: Request, db: Banco): Promise<Sessao | null> {
  const token = lerCookie(req, COOKIE);
  if (!token) return null;
  const { rows } = await db.query<{
    id: string; nome: string; email: string; papel: Papel; ativo: boolean; fazenda_id: string; fazenda_nome: string;
  }>(
    `SELECT u.id, u.nome, u.email, u.papel, u.ativo, f.id AS fazenda_id, f.nome AS fazenda_nome
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id JOIN fazendas f ON f.id = u.fazenda_id
      WHERE s.token_hash = $1 AND s.expira_em > now() AND u.ativo`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    usuario: { id: r.id, nome: r.nome, email: r.email, papel: r.papel, ativo: r.ativo },
    fazenda: { id: r.fazenda_id, nome: r.fazenda_nome },
  };
}

async function exigirSessao(req: Request, db: Banco): Promise<Sessao> {
  const s = await sessaoAtual(req, db);
  if (!s) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
  return s;
}

/* ------------------------------ Rotas ------------------------------- */

async function estado(db: Banco) {
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM fazendas');
  return json({ inicializado: rows[0].n > 0 });
}

/** Cria a estância e o primeiro usuário (administrador). Só é permitido enquanto o banco está vazio. */
async function cadastro(req: Request, db: Banco) {
  const corpo = await lerJson<Record<string, unknown>>(req);
  const nomeEstancia = texto(corpo.nomeEstancia, 'nome da estância');
  const nome = texto(corpo.nome, 'nome');
  const mail = email(corpo.email);
  const hash = await gerarHashSenha(senha(corpo.senha));

  const r = await db.transacao(async (c) => {
    // Trava para que duas pessoas não criem a primeira estância ao mesmo tempo.
    await c.query('SELECT pg_advisory_xact_lock(4242)');
    const { rows } = await c.query<{ n: number }>('SELECT count(*)::int AS n FROM fazendas');
    if (rows[0].n > 0) throw new ErroHttp(403, 'A estância já foi criada. Peça um acesso ao administrador.');
    const f = (await c.query<{ id: string }>('INSERT INTO fazendas (nome) VALUES ($1) RETURNING id', [nomeEstancia])).rows[0];
    const u = (
      await c.query<{ id: string }>(
        `INSERT INTO usuarios (fazenda_id, nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
        [f.id, nome, mail, hash],
      )
    ).rows[0];
    const token = await criarSessao(c, u.id);
    return {
      token,
      sessao: { usuario: { id: u.id, nome, email: mail, papel: 'admin' as Papel, ativo: true }, fazenda: { id: f.id, nome: nomeEstancia } },
    };
  });
  return json(r.sessao, 201, { 'set-cookie': cookieSessao(req, r.token, DURACAO_SESSAO_DIAS * 86400) });
}

let hashFalso: Promise<string> | undefined;

async function login(req: Request, db: Banco) {
  const corpo = await lerJson<Record<string, unknown>>(req);
  const mail = email(corpo.email);
  const s = typeof corpo.senha === 'string' ? corpo.senha : '';
  const { rows } = await db.query<{ id: string; senha_hash: string; ativo: boolean }>(
    'SELECT id, senha_hash, ativo FROM usuarios WHERE email = $1',
    [mail],
  );
  const u = rows[0];
  // Calcula o hash mesmo sem usuário para não revelar quais e-mails existem pelo tempo de resposta.
  const ok = await verificarSenha(s, u?.senha_hash ?? (await (hashFalso ??= gerarHashSenha(gerarToken()))));
  if (!u || !ok || !u.ativo) throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  const token = await criarSessao(db, u.id);
  await db.query('DELETE FROM sessoes WHERE usuario_id = $1 AND expira_em < now()', [u.id]);
  const sessao = await sessaoAtual(new Request(req.url, { headers: { cookie: `${COOKIE}=${token}` } }), db);
  return json(sessao, 200, { 'set-cookie': cookieSessao(req, token, DURACAO_SESSAO_DIAS * 86400) });
}

async function logout(req: Request, db: Banco) {
  const token = lerCookie(req, COOKIE);
  if (token) await db.query('DELETE FROM sessoes WHERE token_hash = $1', [hashToken(token)]);
  return json({ ok: true }, 200, { 'set-cookie': cookieSessao(req, '', 0) });
}

async function trocarSenha(req: Request, db: Banco, s: Sessao) {
  const corpo = await lerJson<Record<string, unknown>>(req);
  const nova = senha(corpo.novaSenha);
  const { rows } = await db.query<{ senha_hash: string }>('SELECT senha_hash FROM usuarios WHERE id = $1', [s.usuario.id]);
  if (!(await verificarSenha(String(corpo.senhaAtual ?? ''), rows[0].senha_hash))) throw new ErroHttp(400, 'Senha atual incorreta.');
  await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await gerarHashSenha(nova), s.usuario.id]);
  // Encerra as outras sessões do usuário.
  const atual = hashToken(lerCookie(req, COOKIE) ?? '');
  await db.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2', [s.usuario.id, atual]);
  return json({ ok: true });
}

/* ---------------------------- Usuários ------------------------------ */

const exigirAdmin = (s: Sessao) => {
  if (s.usuario.papel !== 'admin') throw new ErroHttp(403, 'Apenas administradores podem gerenciar usuários.');
};
const papel = (v: unknown): Papel => (v === 'admin' ? 'admin' : 'membro');

async function listarUsuarios(db: Banco, s: Sessao) {
  exigirAdmin(s);
  const { rows } = await db.query<UsuarioPublico>(
    'SELECT id, nome, email, papel, ativo FROM usuarios WHERE fazenda_id = $1 ORDER BY nome',
    [s.fazenda.id],
  );
  return json(rows);
}

async function criarUsuario(req: Request, db: Banco, s: Sessao) {
  exigirAdmin(s);
  const corpo = await lerJson<Record<string, unknown>>(req);
  const dados = { nome: texto(corpo.nome, 'nome'), email: email(corpo.email), papel: papel(corpo.papel) };
  const hash = await gerarHashSenha(senha(corpo.senha));
  const existe = await db.query('SELECT 1 FROM usuarios WHERE email = $1', [dados.email]);
  if (existe.rows.length) throw new ErroHttp(409, 'Já existe um usuário com este e-mail.');
  const { rows } = await db.query<UsuarioPublico>(
    `INSERT INTO usuarios (fazenda_id, nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nome, email, papel, ativo`,
    [s.fazenda.id, dados.nome, dados.email, hash, dados.papel],
  );
  return json(rows[0], 201);
}

async function alterarUsuario(req: Request, db: Banco, s: Sessao, id: string) {
  exigirAdmin(s);
  const corpo = await lerJson<Record<string, unknown>>(req);
  const alvo = await db.query<{ id: string }>('SELECT id FROM usuarios WHERE id::text = $1 AND fazenda_id = $2', [id, s.fazenda.id]);
  if (!alvo.rows.length) throw new ErroHttp(404, 'Usuário não encontrado.');
  if (id === s.usuario.id && (corpo.ativo === false || corpo.papel === 'membro')) {
    throw new ErroHttp(400, 'Você não pode desativar nem rebaixar a própria conta.');
  }
  if (typeof corpo.ativo === 'boolean') {
    await db.query('UPDATE usuarios SET ativo = $1 WHERE id = $2', [corpo.ativo, id]);
    if (!corpo.ativo) await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
  }
  if (corpo.papel !== undefined) await db.query('UPDATE usuarios SET papel = $1 WHERE id = $2', [papel(corpo.papel), id]);
  if (corpo.senha !== undefined) {
    await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await gerarHashSenha(senha(corpo.senha)), id]);
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
  }
  const { rows } = await db.query<UsuarioPublico>('SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = $1', [id]);
  return json(rows[0]);
}

/* ---------------------------- Sincronização ------------------------- */

function validarMudanca(m: unknown): Mudanca {
  const x = m as Partial<Mudanca>;
  if (!x || typeof x !== 'object') throw new ErroHttp(400, 'Mudança inválida.');
  if (typeof x.colecao !== 'string' || !COLECOES.has(x.colecao)) throw new ErroHttp(400, `Coleção inválida: ${String(x.colecao)}.`);
  if (typeof x.id !== 'string' || !x.id || x.id.length > 100) throw new ErroHttp(400, 'Identificador inválido.');
  if (typeof x.modificadoEm !== 'number' || !Number.isFinite(x.modificadoEm)) throw new ErroHttp(400, 'Data de modificação inválida.');
  if (x.dados !== null && (typeof x.dados !== 'object' || Array.isArray(x.dados))) throw new ErroHttp(400, 'Dados inválidos.');
  if (x.dados && JSON.stringify(x.dados).length > TAMANHO_MAX_REGISTRO) throw new ErroHttp(413, 'Registro muito grande.');
  return { colecao: x.colecao, id: x.id, dados: x.dados ?? null, modificadoEm: Math.trunc(x.modificadoEm) };
}

interface LinhaRegistro {
  colecao: Mudanca['colecao'];
  id: string;
  dados: Record<string, unknown> | null;
  excluido: boolean;
  modificado_em: string | number;
  seq: string | number;
}

const paraMudanca = (r: LinhaRegistro): Mudanca => ({
  colecao: r.colecao,
  id: r.id,
  dados: r.excluido ? null : r.dados,
  modificadoEm: Number(r.modificado_em),
});

/**
 * Recebe as alterações do aparelho e devolve as alterações de todos desde o cursor.
 * Conflitos: vence a alteração mais recente (modificadoEm); horários no futuro são limitados ao relógio do servidor.
 */
async function sincronizar(req: Request, db: Banco, s: Sessao) {
  const corpo = await lerJson<RequisicaoSync>(req);
  const cursor = Number.isFinite(corpo.cursor) && corpo.cursor > 0 ? Math.trunc(corpo.cursor) : 0;
  const recebidas = Array.isArray(corpo.mudancas) ? corpo.mudancas : [];
  if (recebidas.length > LIMITE_MUDANCAS_POR_ENVIO) throw new ErroHttp(413, 'Mudanças demais em um único envio.');
  const mudancas = recebidas.map(validarMudanca);
  const agora = Date.now();
  // Se o mesmo registro vier mais de uma vez, fica só a versão mais recente.
  const unicas = new Map<string, Mudanca>();
  for (const m of mudancas) {
    const k = `${m.colecao}\u0000${m.id}`;
    const atual = unicas.get(k);
    if (!atual || atual.modificadoEm <= m.modificadoEm) unicas.set(k, { ...m, modificadoEm: Math.min(m.modificadoEm, agora) });
  }
  const lista = [...unicas.values()];

  const rejeitadas: Mudanca[] = [];
  if (lista.length) {
    await db.transacao(async (c) => {
      // Serializa as gravações de cada estância: garante que o `seq` seja visível em ordem para quem busca.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [s.fazenda.id]);
      // Uma única instrução para o lote inteiro (rápido mesmo com centenas de registros).
      const { rows } = await c.query<{ colecao: string; id: string }>(
        `INSERT INTO registros (fazenda_id, colecao, id, dados, excluido, modificado_em, atualizado_por)
         SELECT $1, t.colecao, t.id, t.dados, t.dados IS NULL, t.modificado_em, $2
           FROM unnest($3::text[], $4::text[], $5::jsonb[], $6::bigint[]) AS t(colecao, id, dados, modificado_em)
         ON CONFLICT (fazenda_id, colecao, id) DO UPDATE
           SET dados = EXCLUDED.dados, excluido = EXCLUDED.excluido, modificado_em = EXCLUDED.modificado_em,
               atualizado_por = EXCLUDED.atualizado_por, seq = nextval('registros_seq'), recebido_em = now()
           WHERE registros.modificado_em <= EXCLUDED.modificado_em
         RETURNING colecao, id`,
        [
          s.fazenda.id,
          s.usuario.id,
          lista.map((m) => m.colecao),
          lista.map((m) => m.id),
          lista.map((m) => (m.dados ? JSON.stringify(m.dados) : null)),
          lista.map((m) => m.modificadoEm),
        ],
      );
      const aceitas = new Set(rows.map((r) => `${r.colecao}\u0000${r.id}`));
      const perdedoras = lista.filter((m) => !aceitas.has(`${m.colecao}\u0000${m.id}`));
      if (perdedoras.length) {
        const atuais = await c.query<LinhaRegistro>(
          `SELECT r.colecao, r.id, r.dados, r.excluido, r.modificado_em, r.seq
             FROM registros r JOIN unnest($2::text[], $3::text[]) AS t(colecao, id) ON r.colecao = t.colecao AND r.id = t.id
            WHERE r.fazenda_id = $1`,
          [s.fazenda.id, perdedoras.map((m) => m.colecao), perdedoras.map((m) => m.id)],
        );
        rejeitadas.push(...atuais.rows.map(paraMudanca));
      }
    });
  }

  const { rows } = await db.query<LinhaRegistro>(
    `SELECT colecao, id, dados, excluido, modificado_em, seq FROM registros
      WHERE fazenda_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
    [s.fazenda.id, cursor, LIMITE_MUDANCAS_POR_BUSCA + 1],
  );
  const mais = rows.length > LIMITE_MUDANCAS_POR_BUSCA;
  const pagina = rows.slice(0, LIMITE_MUDANCAS_POR_BUSCA);
  const resposta: RespostaSync = {
    cursor: pagina.length ? Number(pagina[pagina.length - 1].seq) : cursor,
    mudancas: pagina.map(paraMudanca),
    mais,
    rejeitadas,
  };
  return json(resposta);
}

/* ------------------------------ Roteador ---------------------------- */

export async function tratarRequisicao(req: Request, db: Banco): Promise<Response> {
  const url = new URL(req.url);
  const caminho = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const m = req.method;
  try {
    if (caminho === '/estado' && m === 'GET') return await estado(db);
    if (caminho === '/cadastro' && m === 'POST') return await cadastro(req, db);
    if (caminho === '/login' && m === 'POST') return await login(req, db);
    if (caminho === '/logout' && m === 'POST') return await logout(req, db);

    const s = await exigirSessao(req, db);
    if (caminho === '/eu' && m === 'GET') return json(s);
    if (caminho === '/eu/senha' && m === 'POST') return await trocarSenha(req, db, s);
    if (caminho === '/sync' && m === 'POST') return await sincronizar(req, db, s);
    if (caminho === '/usuarios' && m === 'GET') return await listarUsuarios(db, s);
    if (caminho === '/usuarios' && m === 'POST') return await criarUsuario(req, db, s);
    const mu = caminho.match(/^\/usuarios\/([\w-]+)$/);
    if (mu && m === 'PATCH') return await alterarUsuario(req, db, s, mu[1]);
    return json({ erro: 'Rota não encontrada.' }, 404);
  } catch (e) {
    if (e instanceof ErroHttp) return json({ erro: e.message }, e.status);
    console.error('[api] erro inesperado', e);
    return json({ erro: 'Erro interno no servidor.' }, 500);
  }
}

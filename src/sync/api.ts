import type { FazendaPublica, RequisicaoSync, RespostaSync, UsuarioPublico, Papel } from '../../shared/colecoes';

export interface Sessao {
  usuario: UsuarioPublico;
  fazenda: FazendaPublica;
}

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
  /** Sem conexão com o servidor (status 0). */
  get offline() {
    return this.status === 0;
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor.');
  }
  const tipo = res.headers.get('content-type') ?? '';
  const dados = tipo.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    // Respostas que não são da nossa API (ex.: portal de Wi-Fi, servidor fora do ar) contam como offline.
    if (!tipo.includes('application/json')) throw new ErroApi(0, 'Servidor indisponível.');
    throw new ErroApi(res.status, (dados as { erro?: string }).erro ?? `Erro ${res.status}`);
  }
  return dados as T;
}

export const api = {
  estado: () => chamar<{ inicializado: boolean }>('GET', '/estado'),
  cadastro: (d: { nomeEstancia: string; nome: string; email: string; senha: string }) => chamar<Sessao>('POST', '/cadastro', d),
  login: (email: string, senha: string) => chamar<Sessao>('POST', '/login', { email, senha }),
  logout: () => chamar<{ ok: true }>('POST', '/logout', {}),
  eu: () => chamar<Sessao>('GET', '/eu'),
  trocarSenha: (senhaAtual: string, novaSenha: string) => chamar<{ ok: true }>('POST', '/eu/senha', { senhaAtual, novaSenha }),
  sync: (r: RequisicaoSync) => chamar<RespostaSync>('POST', '/sync', r),
  usuarios: () => chamar<UsuarioPublico[]>('GET', '/usuarios'),
  criarUsuario: (d: { nome: string; email: string; senha: string; papel: Papel }) => chamar<UsuarioPublico>('POST', '/usuarios', d),
  alterarUsuario: (id: string, d: { ativo?: boolean; papel?: Papel; senha?: string }) => chamar<UsuarioPublico>('PATCH', `/usuarios/${id}`, d),
};

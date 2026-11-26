// Plugin do Vite que serve a API (/api/*) localmente com PostgreSQL embutido (PGlite).
// Permite rodar e testar o app completo sem conta no Netlify: `npm run dev`.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { criarBancoLocal } from './banco-local';
import { tratarRequisicao } from './rotas';
import type { Banco } from './banco';

export function apiLocal(diretorioDados = join(process.cwd(), '.dados-locais')): Plugin {
  let banco: Promise<Banco> | undefined;
  const obterBanco = () => {
    if (!banco) {
      mkdirSync(diretorioDados, { recursive: true });
      banco = criarBancoLocal(join(diretorioDados, 'pglite'));
    }
    return banco;
  };

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      const corpo = await new Promise<Buffer>((ok, falha) => {
        const partes: Buffer[] = [];
        req.on('data', (c: Buffer) => partes.push(c));
        req.on('end', () => ok(Buffer.concat(partes)));
        req.on('error', falha);
      });
      const host = req.headers.host ?? 'localhost';
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const resposta = await tratarRequisicao(
        new Request(`http://${host}${req.url}`, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : new Uint8Array(corpo),
        }),
        await obterBanco(),
      );
      res.statusCode = resposta.status;
      resposta.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await resposta.arrayBuffer()));
    } catch (e) {
      console.error('[api-local]', e);
      res.statusCode = 500;
      res.end('{"erro":"Erro no servidor local."}');
    }
  };

  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

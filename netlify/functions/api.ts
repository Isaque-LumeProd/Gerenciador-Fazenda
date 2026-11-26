import type { Config } from '@netlify/functions';
import { tratarRequisicao } from '../../server/rotas';
import { bancoNetlify } from '../../server/banco-netlify';

export default (req: Request) =>
  tratarRequisicao(req, bancoNetlify(), {
    // Código secreto para criar a estância (variável CODIGO_CADASTRO no Netlify). Sem ele, o cadastro fica bloqueado.
    codigoCadastro: process.env.CODIGO_CADASTRO?.trim() || null,
  });

export const config: Config = {
  path: '/api/*',
};

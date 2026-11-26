import type { Config } from '@netlify/functions';
import { tratarRequisicao } from '../../server/rotas';
import { bancoNetlify } from '../../server/banco-netlify';

export default (req: Request) => tratarRequisicao(req, bancoNetlify());

export const config: Config = {
  path: '/api/*',
};

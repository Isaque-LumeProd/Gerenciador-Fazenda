import { getDatabase } from '@netlify/database';
import { bancoDePool, type Banco } from './banco';

let banco: Banco | undefined;

/** Conexão com o Netlify Database (usa NETLIFY_DB_URL, configurado automaticamente pelo Netlify). */
export function bancoNetlify(): Banco {
  if (!banco) banco = bancoDePool(getDatabase().pool as never);
  return banco;
}

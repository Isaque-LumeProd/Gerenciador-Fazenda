// Banco PostgreSQL embutido (PGlite) para desenvolvimento local e testes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { Banco, Cliente } from './banco';

export const PASTA_MIGRACOES = join(process.cwd(), 'netlify', 'database', 'migrations');

/** Lista as migrações (arquivo .sql ou pasta com migration.sql) em ordem. */
function listarMigracoes(pasta: string): { nome: string; sql: string }[] {
  return readdirSync(pasta)
    .sort()
    .map((nome) => {
      const caminho = join(pasta, nome);
      const arquivo = statSync(caminho).isDirectory() ? join(caminho, 'migration.sql') : caminho;
      return { nome, sql: readFileSync(arquivo, 'utf8') };
    });
}

export async function criarBancoLocal(diretorio?: string, pastaMigracoes = PASTA_MIGRACOES): Promise<Banco> {
  const pg = new PGlite(diretorio);
  await pg.exec('CREATE TABLE IF NOT EXISTS _migracoes_locais (nome text PRIMARY KEY, aplicada_em timestamptz DEFAULT now())');
  const aplicadas = new Set((await pg.query<{ nome: string }>('SELECT nome FROM _migracoes_locais')).rows.map((r) => r.nome));
  for (const m of listarMigracoes(pastaMigracoes)) {
    if (aplicadas.has(m.nome)) continue;
    await pg.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('INSERT INTO _migracoes_locais (nome) VALUES ($1)', [m.nome]);
    });
  }

  // PGlite processa uma operação por vez; serializamos as transações para imitar o isolamento do servidor.
  let fila: Promise<unknown> = Promise.resolve();
  const banco: Banco = {
    query: (sql, params) => pg.query(sql, params) as never,
    transacao<T>(fn: (c: Cliente) => Promise<T>) {
      const exec = fila.then(() => pg.transaction((tx) => fn(tx as unknown as Cliente)));
      fila = exec.catch(() => undefined);
      return exec as Promise<T>;
    },
  };
  return banco;
}

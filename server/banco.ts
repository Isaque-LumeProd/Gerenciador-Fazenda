// Abstração mínima de banco: funciona com o pool do Netlify Database (pg / Neon)
// e com o PGlite usado no desenvolvimento local e nos testes.

export interface Cliente {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Banco extends Cliente {
  /** Executa `fn` dentro de uma transação (BEGIN/COMMIT, ROLLBACK em caso de erro). */
  transacao<T>(fn: (c: Cliente) => Promise<T>): Promise<T>;
}

interface PoolLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  connect(): Promise<{ query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>; release(): void }>;
}

/** Adapta um pool compatível com `pg.Pool`. */
export function bancoDePool(pool: PoolLike): Banco {
  return {
    query: (sql, params) => pool.query(sql, params) as never,
    async transacao(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const r = await fn(cliente as unknown as Cliente);
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        cliente.release();
      }
    },
  };
}

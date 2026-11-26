import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions) =>
  new Promise<Buffer>((ok, falha) => scryptCb(senha, sal, tamanho, opcoes, (e, chave) => (e ? falha(e) : ok(chave))));

/** Custo do scrypt (N = 2^15, r = 8, p = 1): cerca de 32 MB e 100 ms por senha, dificultando ataques de dicionário. */
const N = 2 ** 15;
const R = 8;
const P = 1;
const memoria = (n: number, r: number) => 128 * n * r * 2;

/** Formato: scrypt$N$r$p$sal$hash (parâmetros gravados para permitir aumentar o custo no futuro). */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64, { N, r: R, p: P, maxmem: memoria(N, R) });
  return ['scrypt', N, R, P, sal.toString('hex'), hash.toString('hex')].join('$');
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes[0] !== 'scrypt') return false;
  let n = 16384;
  let r = 8;
  let p = 1;
  let salHex: string;
  let hashHex: string;
  if (partes.length === 6) {
    [n, r, p] = partes.slice(1, 4).map(Number);
    [salHex, hashHex] = partes.slice(4);
  } else if (partes.length === 3) {
    [salHex, hashHex] = partes.slice(1); // formato antigo, com o N padrão
  } else {
    return false;
  }
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || n > 2 ** 20 || r > 32 || p > 4) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  if (!esperado.length) return false;
  const obtido = await scrypt(senha, Buffer.from(salHex, 'hex'), esperado.length, { N: n, r, p, maxmem: memoria(n, r) });
  return timingSafeEqual(esperado, obtido);
}

/** Compara dois segredos em tempo constante (não revela quantos caracteres batem). */
export function compararSegredo(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Guardamos só o hash do token: um vazamento do banco não permite usar as sessões. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

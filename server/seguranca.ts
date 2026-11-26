import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, salHex, hashHex] = armazenado.split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtido = await scrypt(senha, Buffer.from(salHex, 'hex'), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

export function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Guardamos só o hash do token: um vazamento do banco não permite usar as sessões. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

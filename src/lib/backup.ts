// Validação de arquivos de backup antes de importar: um arquivo adulterado poderia
// gravar dados malformados que travariam o app de todos os usuários.
import { COLECOES_SYNC } from '../../shared/colecoes';
import { validarRegistro } from '../../shared/esquema';
import { CONFIG_PADRAO } from '@/store/useFazenda';
import type { Configuracao, DadosFazenda } from '@/types';

export function validarBackup(entrada: unknown): { ok: true; dados: DadosFazenda } | { ok: false; erros: string[] } {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, erros: ['O arquivo não é um backup da Fazenda Ativa.'] };
  const bruto = entrada as Record<string, unknown>;
  const erros: string[] = [];
  const saida: Record<string, unknown> = {};

  for (const colecao of COLECOES_SYNC) {
    if (colecao === 'config') continue;
    const lista = bruto[colecao] ?? [];
    if (!Array.isArray(lista)) {
      erros.push(`${colecao}: deveria ser uma lista`);
      continue;
    }
    const ids = new Set<string>();
    const validos: unknown[] = [];
    lista.forEach((item, i) => {
      const id = (item as { id?: unknown })?.id;
      if (typeof id !== 'string' || !id || id.length > 100) return void erros.push(`${colecao} nº ${i + 1}: identificador inválido`);
      if (ids.has(id)) return void erros.push(`${colecao} nº ${i + 1}: identificador repetido`);
      ids.add(id);
      const v = validarRegistro(colecao, id, item);
      if (v.ok) validos.push(v.registro);
      else erros.push(`${colecao} nº ${i + 1}: ${v.erros.slice(0, 2).join('; ')}`);
    });
    saida[colecao] = validos;
  }

  const cfg = validarRegistro('config', 'config', { ...CONFIG_PADRAO, ...((bruto.config as object) ?? {}) });
  if (cfg.ok) saida.config = cfg.registro as unknown as Configuracao;
  else erros.push(`configurações: ${cfg.erros.slice(0, 2).join('; ')}`);

  return erros.length ? { ok: false, erros } : { ok: true, dados: saida as unknown as DadosFazenda };
}

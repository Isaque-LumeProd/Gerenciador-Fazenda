import { sincronizar, useSync } from '@/sync/motor';

const rotulo = (estado: string, pendentes: number) => {
  if (estado === 'sincronizando') return 'Sincronizando…';
  if (estado === 'offline') return pendentes ? `Sem internet · ${pendentes} a enviar` : 'Sem internet';
  if (estado === 'erro') return 'Erro ao sincronizar';
  if (estado === 'sem-sessao') return 'Sessão expirada';
  return pendentes ? `${pendentes} a enviar` : 'Sincronizado';
};

/** Indicador compacto do estado da sincronização. Clique para sincronizar agora. */
export function StatusSync({ claro }: { claro?: boolean }) {
  const estado = useSync((s) => s.estado);
  const erro = useSync((s) => s.erro);
  const pendentes = useSync((s) => Object.keys(s.pendentes).length);
  const ultima = useSync((s) => s.ultimaSync);
  const tom =
    estado === 'erro' || estado === 'sem-sessao' ? 'erro' : estado === 'offline' ? 'offline' : pendentes || estado === 'sincronizando' ? 'pendente' : 'ok';
  const titulo = [erro, ultima ? `Última sincronização: ${new Date(ultima).toLocaleString('pt-BR')}` : null, 'Clique para sincronizar agora']
    .filter(Boolean)
    .join('\n');
  return (
    <button className={`status-sync ${tom} ${claro ? 'claro' : ''}`} onClick={() => void sincronizar()} title={titulo} aria-live="polite">
      <span className="ponto" aria-hidden="true" />
      {rotulo(estado, pendentes)}
    </button>
  );
}

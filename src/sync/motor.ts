// Motor de sincronização offline-first.
//
// - Todas as telas continuam lendo e gravando no store local (useFazenda), que fica salvo no aparelho.
// - Cada alteração local entra numa fila de pendências (persistida), mesmo sem internet.
// - Quando há conexão, a fila é enviada ao servidor e as alterações de outros usuários são baixadas.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useFazenda } from '@/store/useFazenda';
import { LIMITE_MUDANCAS_POR_ENVIO } from '../../shared/colecoes';
import { api, ErroApi, type Sessao } from './api';
import { aplicarRemotas, detectarMudancas, montarEnvio, todasAsChaves, type Pendentes } from './nucleo';

export type EstadoSync = 'ocioso' | 'sincronizando' | 'ok' | 'offline' | 'erro' | 'sem-sessao';

interface SyncState {
  // Persistido
  sessao: Sessao | null;
  fazendaId: string | null;
  cursor: number;
  pendentes: Pendentes;
  ultimaSync: number | null;
  // Volátil
  estado: EstadoSync;
  erro: string | null;
  sessaoExpirada: boolean;
}

export const useSync = create<SyncState>()(
  persist(
    (): SyncState => ({
      sessao: null,
      fazendaId: null,
      cursor: 0,
      pendentes: {},
      ultimaSync: null,
      estado: 'ocioso' as EstadoSync,
      erro: null,
      sessaoExpirada: false,
    }),
    {
      name: 'gerenciador-fazenda:sync',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sessao: s.sessao, fazendaId: s.fazendaId, cursor: s.cursor, pendentes: s.pendentes, ultimaSync: s.ultimaSync }),
    },
  ),
);

/* ------------------------- Registro de alterações ------------------------- */

let aplicandoRemoto = false;
let ultimoCarimbo = 0;
/** Carimbo de tempo estritamente crescente neste aparelho. */
const carimbo = () => (ultimoCarimbo = Math.max(Date.now(), ultimoCarimbo + 1));

function marcar(chaves: string[]) {
  if (!chaves.length) return;
  const t = carimbo();
  useSync.setState((s) => {
    const pendentes = { ...s.pendentes };
    for (const k of chaves) pendentes[k] = t;
    return { pendentes };
  });
}

/** Altera o store local sem gerar pendências (dados que vieram do servidor ou limpeza da conta). */
function semRegistrar(fn: () => void) {
  aplicandoRemoto = true;
  try {
    fn();
  } finally {
    aplicandoRemoto = false;
  }
}

/* ------------------------------ Sincronização ----------------------------- */

let rodando: Promise<void> | null = null;
let repetir = false;
let temporizador: ReturnType<typeof setTimeout> | undefined;

/** Agenda uma sincronização em breve (agrupa várias alterações seguidas). */
export function agendarSync(atrasoMs = 1500) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => void sincronizar(), atrasoMs);
}

export function sincronizar(): Promise<void> {
  if (rodando) {
    repetir = true;
    return rodando;
  }
  rodando = executar().finally(() => {
    rodando = null;
    if (repetir) {
      repetir = false;
      agendarSync(200);
    }
  });
  return rodando;
}

async function executar() {
  const { sessao, sessaoExpirada } = useSync.getState();
  if (!sessao || sessaoExpirada) {
    useSync.setState({ estado: 'sem-sessao' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSync.setState({ estado: 'offline' });
    return;
  }
  useSync.setState({ estado: 'sincronizando', erro: null });
  try {
    for (let rodada = 0; rodada < 50; rodada++) {
      const { pendentes, cursor } = useSync.getState();
      const envio = montarEnvio(useFazenda.getState(), pendentes, LIMITE_MUDANCAS_POR_ENVIO);
      const resp = await api.sync({ cursor, mudancas: envio });

      // Remove da fila o que foi enviado (se não foi alterado de novo durante o envio).
      const fila = { ...useSync.getState().pendentes };
      for (const m of envio) {
        const k = `${m.colecao}/${m.id}`;
        if (fila[k] === m.modificadoEm) delete fila[k];
      }

      const { patch, descartar } = aplicarRemotas(useFazenda.getState(), [...resp.mudancas, ...resp.rejeitadas], fila);
      for (const k of descartar) delete fila[k];
      semRegistrar(() => useFazenda.setState(patch));
      useSync.setState({ pendentes: fila, cursor: resp.cursor });

      const restantes = Object.keys(fila).length;
      if (!resp.mais && (restantes === 0 || envio.length < LIMITE_MUDANCAS_POR_ENVIO)) break;
    }
    useSync.setState({ estado: 'ok', ultimaSync: Date.now() });
    if (Object.keys(useSync.getState().pendentes).length) agendarSync();
  } catch (e) {
    if (e instanceof ErroApi && e.status === 401) {
      useSync.setState({ estado: 'sem-sessao', sessaoExpirada: true, erro: e.message });
    } else if (e instanceof ErroApi && e.offline) {
      useSync.setState({ estado: 'offline', erro: null });
    } else {
      useSync.setState({ estado: 'erro', erro: (e as Error).message });
    }
  }
}

/* --------------------------------- Sessão -------------------------------- */

/** Limpa os dados da estância guardados neste aparelho. */
function limparLocal() {
  semRegistrar(() => useFazenda.getState().limparTudo());
  useSync.setState({ cursor: 0, pendentes: {}, ultimaSync: null });
}

/**
 * Registra a sessão após login/cadastro.
 * - Mesma estância já usada neste aparelho: mantém dados e pendências.
 * - Outra estância: descarta os dados locais e baixa tudo do servidor.
 * - `enviarDadosLocais`: em uma estância nova, envia o que já está cadastrado no aparelho.
 */
export function iniciarSessao(sessao: Sessao, opcoes: { enviarDadosLocais?: boolean } = {}) {
  const { fazendaId } = useSync.getState();
  if (fazendaId !== sessao.fazenda.id) {
    if (opcoes.enviarDadosLocais) {
      useSync.setState({ cursor: 0, pendentes: {}, ultimaSync: null });
      marcar(todasAsChaves(useFazenda.getState()));
    } else {
      limparLocal();
    }
  }
  useSync.setState({ sessao, fazendaId: sessao.fazenda.id, sessaoExpirada: false, erro: null });
  void sincronizar();
}

export async function sair() {
  await api.logout().catch(() => undefined);
  limparLocal();
  useSync.setState({ sessao: null, fazendaId: null, sessaoExpirada: false, estado: 'sem-sessao' });
}

/** Confere a sessão no servidor (atualiza nome/papel; detecta sessão expirada). */
export async function conferirSessao() {
  try {
    const s = await api.eu();
    useSync.setState({ sessao: s });
  } catch (e) {
    if (e instanceof ErroApi && e.status === 401) useSync.setState({ sessaoExpirada: true, estado: 'sem-sessao' });
  }
}

/* --------------------------------- Início -------------------------------- */

let iniciado = false;

/** Liga o motor: observa o store local e sincroniza ao abrir, ao voltar a internet e periodicamente. */
export function iniciarMotor() {
  if (iniciado) return;
  iniciado = true;

  useFazenda.subscribe((depois, antes) => {
    if (aplicandoRemoto) return;
    const chaves = detectarMudancas(antes, depois);
    if (chaves.length) {
      marcar(chaves);
      agendarSync();
    }
  });

  window.addEventListener('online', () => void sincronizar());
  window.addEventListener('offline', () => useSync.setState({ estado: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar();
  });
  setInterval(() => void sincronizar(), 30_000);

  // Pede ao navegador para não apagar os dados locais por falta de espaço.
  void navigator.storage?.persist?.().catch(() => undefined);

  if (useSync.getState().sessao) {
    void conferirSessao().then(() => sincronizar());
  }
}

export const contarPendentes = (p: Pendentes) => Object.keys(p).length;

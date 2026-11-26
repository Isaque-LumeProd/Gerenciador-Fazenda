import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';
import { NomeMarca, Simbolo } from './Logo';
import { useFazenda } from '@/store/useFazenda';
import { gerarAlertas } from '@/lib/alertas';
import { StatusSync } from './StatusSync';
import { useSync } from '@/sync/motor';
import Entrar from '@/pages/Entrar';

const menu: { grupo?: string; to: string; rotulo: string; icone: NomeIcone; fim?: boolean }[] = [
  { to: '/', rotulo: 'Painel', icone: 'painel', fim: true },
  { grupo: 'Bovinos', to: '/bovinos', rotulo: 'Rebanho', icone: 'boi', fim: true },
  { to: '/bovinos/pesagens', rotulo: 'Pesagens', icone: 'balanca' },
  { to: '/bovinos/reproducao', rotulo: 'Reprodução', icone: 'coracao' },
  { to: '/bovinos/leite', rotulo: 'Leite', icone: 'leite' },
  { grupo: 'Aves', to: '/aves', rotulo: 'Lotes de aves', icone: 'galinha', fim: true },
  { to: '/aves/producao', rotulo: 'Produção diária', icone: 'ovo' },
  { grupo: 'Manejo', to: '/sanidade', rotulo: 'Sanidade', icone: 'saude' },
  { to: '/pastagens', rotulo: 'Pastagens', icone: 'pasto' },
  { to: '/estoque', rotulo: 'Estoque', icone: 'estoque' },
  { grupo: 'Gestão', to: '/financeiro', rotulo: 'Financeiro', icone: 'dinheiro' },
  { to: '/agenda', rotulo: 'Agenda', icone: 'agenda' },
  { to: '/equipe', rotulo: 'Equipe', icone: 'pessoas' },
  { to: '/configuracoes', rotulo: 'Configurações', icone: 'config' },
];

type Tema = 'auto' | 'light' | 'dark';

function lerTema(): Tema {
  try {
    return (localStorage.getItem('gerenciador-fazenda:tema') as Tema) || 'auto';
  } catch {
    return 'auto';
  }
}

export function Layout() {
  const [aberta, setAberta] = useState(false);
  const [tema, setTema] = useState<Tema>(lerTema);
  const expirada = useSync((x) => x.sessaoExpirada);
  const [adiado, setAdiado] = useState(false);
  const local = useLocation();
  const nome = useFazenda((s) => s.config.nomeEstancia);
  const s = useFazenda();
  const criticos = useMemo(() => gerarAlertas(s).filter((a) => a.nivel !== 'info').length, [s]);

  useEffect(() => {
    setAberta(false);
    window.scrollTo(0, 0); // cada tela começa no topo
  }, [local.pathname]);

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === 'auto') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', tema);
    try {
      localStorage.setItem('gerenciador-fazenda:tema', tema);
    } catch {
      /* armazenamento indisponível */
    }
  }, [tema]);

  const escuro = tema === 'dark' || (tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  return (
    <div className="app">
      {expirada && !adiado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <Entrar reautenticar onAdiar={() => setAdiado(true)} />
        </div>
      )}
      {aberta && <div className="overlay" onClick={() => setAberta(false)} />}
      <aside className={`sidebar ${aberta ? 'aberta' : ''}`}>
        <div className="brand">
          <Simbolo tamanho={34} />
          <div style={{ minWidth: 0 }}>
            <NomeMarca claro />
            <small>{nome || 'Minha Estância'}</small>
          </div>
        </div>
        <nav>
          {menu.map((m) => (
            <div key={m.to} style={{ display: 'contents' }}>
              {m.grupo && <div className="grupo">{m.grupo}</div>}
              <NavLink to={m.to} end={m.fim}>
                <Icone nome={m.icone} />
                {m.rotulo}
                {m.to === '/' && criticos > 0 && <span className="count">{criticos}</span>}
              </NavLink>
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '0 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <StatusSync claro />
          <button
            className="btn small ghost"
            style={{ color: 'var(--sidebar-text)' }}
            onClick={() => setTema(escuro ? 'light' : 'dark')}
          >
            <Icone nome={escuro ? 'sol' : 'lua'} tamanho={16} />
            {escuro ? 'Tema claro' : 'Tema escuro'}
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setAberta(true)} aria-label="Abrir menu">
            <Icone nome="menu" tamanho={22} />
          </button>
          <span className="marca-topo"><Simbolo tamanho={26} /><strong>{nome}</strong></span>
          <StatusSync />
        </div>
        <main className="content">
          {expirada && adiado && (
            <div className="aviso">
              Sua sessão expirou e as alterações não estão sendo sincronizadas.
              <button className="btn small" onClick={() => setAdiado(false)}>Entrar novamente</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

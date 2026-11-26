import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';
import { useFazenda } from '@/store/useFazenda';
import { gerarAlertas } from '@/lib/alertas';

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
  const local = useLocation();
  const nome = useFazenda((s) => s.config.nomeEstancia);
  const s = useFazenda();
  const criticos = useMemo(() => gerarAlertas(s).filter((a) => a.nivel !== 'info').length, [s]);

  useEffect(() => setAberta(false), [local.pathname]);

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
      {aberta && <div className="overlay" onClick={() => setAberta(false)} />}
      <aside className={`sidebar ${aberta ? 'aberta' : ''}`}>
        <div className="brand">
          <Icone nome="casa" tamanho={26} />
          <div>
            <strong>{nome || 'Minha Estância'}</strong>
            <small>Gerenciador de Fazenda</small>
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
        <div style={{ marginTop: 'auto', padding: '0 18px 18px' }}>
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
          <strong>{nome}</strong>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

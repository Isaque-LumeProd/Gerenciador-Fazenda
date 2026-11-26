import { useEffect, useState } from 'react';
import { api, ErroApi } from '@/sync/api';
import { iniciarSessao, useSync } from '@/sync/motor';
import { useFazenda } from '@/store/useFazenda';
import { NomeMarca, Simbolo } from '@/components/Logo';
import { Campo } from '@/components/ui';

type Modo = 'carregando' | 'login' | 'cadastro' | 'offline';

/** Tela de entrada. Em `reautenticar`, a sessão expirou mas os dados locais e pendências são mantidos. */
export default function Entrar({ reautenticar, onAdiar }: { reautenticar?: boolean; onAdiar?: () => void }) {
  const sessao = useSync((s) => s.sessao);
  const pendentes = useSync((s) => Object.keys(s.pendentes).length);
  const temDadosLocais = useFazenda((s) => s.bovinos.length + s.lotesAves.length + s.lancamentos.length > 0);
  const [modo, setModo] = useState<Modo>(reautenticar ? 'login' : 'carregando');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({ nomeEstancia: '', nome: '', email: sessao?.usuario.email ?? '', senha: '', enviarLocais: false });

  const verificar = () => {
    setModo('carregando');
    api
      .estado()
      .then((r) => setModo(r.inicializado ? 'login' : 'cadastro'))
      .catch(() => setModo('offline'));
  };
  useEffect(() => {
    if (!reautenticar) verificar();
  }, [reautenticar]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (modo === 'cadastro') {
        const s = await api.cadastro({ nomeEstancia: f.nomeEstancia, nome: f.nome, email: f.email, senha: f.senha });
        if (!f.enviarLocais) useFazenda.getState().limparTudo();
        useFazenda.getState().atualizarConfig({ nomeEstancia: f.nomeEstancia });
        iniciarSessao(s, { enviarDadosLocais: true });
      } else {
        const s = await api.login(f.email, f.senha);
        const atual = useSync.getState().fazendaId;
        if (atual && atual !== s.fazenda.id && pendentes > 0 &&
          !confirm(`Este aparelho tem ${pendentes} alteração(ões) não enviada(s) de outra estância. Elas serão descartadas. Continuar?`)) {
          await api.logout().catch(() => undefined);
          return;
        }
        iniciarSessao(s);
      }
    } catch (err) {
      setErro(err instanceof ErroApi && err.offline ? 'Sem conexão com o servidor. Verifique a internet.' : (err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="entrar">
      <div className="entrar-cartao card">
        <div className="entrar-marca">
          <Simbolo tamanho={48} />
          <div>
            <NomeMarca />
            <small>Gestão de gado e aves</small>
          </div>
        </div>

        {modo === 'carregando' && <p className="muted">Conectando ao servidor…</p>}

        {modo === 'offline' && (
          <>
            <p>Não foi possível conectar ao servidor. O primeiro acesso em um aparelho precisa de internet; depois o app funciona sem conexão.</p>
            <button className="btn primary" onClick={verificar}>Tentar novamente</button>
          </>
        )}

        {(modo === 'login' || modo === 'cadastro') && (
          <form onSubmit={enviar} className="stack" style={{ gap: 12 }}>
            {reautenticar ? (
              <p className="small">
                Sua sessão expirou. Entre novamente para continuar sincronizando.
                {pendentes > 0 && <> Há <strong>{pendentes}</strong> alteração(ões) guardadas neste aparelho aguardando envio.</>}
              </p>
            ) : modo === 'cadastro' ? (
              <p className="small">Bem-vindo! Crie a sua estância e a conta de administrador. Depois você poderá cadastrar outros usuários em Configurações.</p>
            ) : (
              <h2>Entrar</h2>
            )}
            {modo === 'cadastro' && (
              <>
                <Campo rotulo="Nome da estância"><input value={f.nomeEstancia} onChange={set('nomeEstancia')} required autoFocus /></Campo>
                <Campo rotulo="Seu nome"><input value={f.nome} onChange={set('nome')} required autoComplete="name" /></Campo>
              </>
            )}
            <Campo rotulo="E-mail"><input type="email" value={f.email} onChange={set('email')} required autoComplete="username" autoFocus={modo === 'login'} /></Campo>
            <Campo rotulo="Senha" dica={modo === 'cadastro' ? 'Mínimo de 8 caracteres' : undefined}>
              <input type="password" value={f.senha} onChange={set('senha')} required minLength={modo === 'cadastro' ? 8 : undefined} autoComplete={modo === 'cadastro' ? 'new-password' : 'current-password'} />
            </Campo>
            {modo === 'cadastro' && temDadosLocais && (
              <label className="check small">
                <input type="checkbox" checked={f.enviarLocais} onChange={set('enviarLocais')} />
                Levar para a conta os dados já cadastrados neste aparelho
              </label>
            )}
            {erro && <div className="aviso-erro">{erro}</div>}
            <button className="btn primary" type="submit" disabled={enviando} style={{ justifyContent: 'center' }}>
              {enviando ? 'Aguarde…' : modo === 'cadastro' ? 'Criar estância' : 'Entrar'}
            </button>
            {reautenticar && onAdiar && (
              <button type="button" className="btn ghost" onClick={onAdiar} style={{ justifyContent: 'center' }}>
                Continuar sem sincronizar por enquanto
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/sync/api';
import { sair, sincronizar, useSync } from '@/sync/motor';
import { Badge, Campo, Card, ModalForm, Vazio } from '@/components/ui';
import { StatusSync } from '@/components/StatusSync';
import { Icone } from '@/components/Icone';
import type { Papel, UsuarioPublico } from '../../shared/colecoes';

const msgErro = (e: unknown) => (e instanceof ErroApi && e.offline ? 'Sem conexão. Tente quando estiver online.' : (e as Error).message);

export function CardConta() {
  const sessao = useSync((s) => s.sessao)!;
  const pendentes = useSync((s) => Object.keys(s.pendentes).length);
  const ultima = useSync((s) => s.ultimaSync);
  const [trocar, setTrocar] = useState(false);
  const [senhas, setSenhas] = useState({ atual: '', nova: '' });

  const confirmarSaida = async () => {
    const aviso = pendentes
      ? `Há ${pendentes} alteração(ões) ainda não enviadas. Se sair agora elas serão PERDIDAS. Sair mesmo assim?`
      : 'Sair da conta? Os dados serão removidos deste aparelho (continuam salvos no servidor).';
    if (pendentes) await sincronizar();
    const ainda = Object.keys(useSync.getState().pendentes).length;
    if (confirm(ainda ? aviso : 'Sair da conta? Os dados serão removidos deste aparelho (continuam salvos no servidor).')) await sair();
  };

  const salvarSenha = async () => {
    try {
      await api.trocarSenha(senhas.atual, senhas.nova);
      setTrocar(false);
      alert('Senha alterada.');
    } catch (e) {
      alert(msgErro(e));
    }
  };

  return (
    <Card titulo="Conta e sincronização">
      <dl className="dl small" style={{ marginBottom: 14 }}>
        <dt>Usuário</dt><dd>{sessao.usuario.nome} <Badge tom={sessao.usuario.papel === 'admin' ? 'verde' : 'neutro'}>{sessao.usuario.papel === 'admin' ? 'administrador' : 'membro'}</Badge></dd>
        <dt>E-mail</dt><dd>{sessao.usuario.email}</dd>
        <dt>Estância</dt><dd>{sessao.fazenda.nome}</dd>
        <dt>Sincronização</dt><dd><StatusSync /></dd>
        <dt>Última</dt><dd>{ultima ? new Date(ultima).toLocaleString('pt-BR') : '—'}</dd>
      </dl>
      <p className="muted small" style={{ marginTop: 0 }}>
        O app funciona sem internet: tudo fica guardado neste aparelho e é enviado automaticamente quando a conexão voltar.
      </p>
      <div className="actions">
        <button className="btn" onClick={() => void sincronizar()}>Sincronizar agora</button>
        <button className="btn" onClick={() => { setSenhas({ atual: '', nova: '' }); setTrocar(true); }}>Trocar senha</button>
        <button className="btn danger" onClick={() => void confirmarSaida()}>Sair</button>
      </div>
      <ModalForm aberto={trocar} titulo="Trocar senha" onFechar={() => setTrocar(false)} onSalvar={salvarSenha}>
        <Campo rotulo="Senha atual" full><input type="password" value={senhas.atual} onChange={(e) => setSenhas({ ...senhas, atual: e.target.value })} required autoComplete="current-password" /></Campo>
        <Campo rotulo="Nova senha" full dica="Mínimo de 8 caracteres"><input type="password" minLength={8} value={senhas.nova} onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })} required autoComplete="new-password" /></Campo>
      </ModalForm>
    </Card>
  );
}

export function CardUsuarios() {
  const eu = useSync((s) => s.sessao!.usuario);
  const [lista, setLista] = useState<UsuarioPublico[] | null>(null);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState<{ aberto: boolean; nome: string; email: string; senha: string; papel: Papel }>({ aberto: false, nome: '', email: '', senha: '', papel: 'membro' });

  const carregar = useCallback(() => {
    api.usuarios().then((l) => { setLista(l); setErro(''); }).catch((e) => setErro(msgErro(e)));
  }, []);
  useEffect(carregar, [carregar]);

  const criar = async () => {
    try {
      await api.criarUsuario({ nome: novo.nome, email: novo.email, senha: novo.senha, papel: novo.papel });
      setNovo({ ...novo, aberto: false });
      carregar();
    } catch (e) {
      alert(msgErro(e));
    }
  };

  const alterar = async (u: UsuarioPublico, d: Parameters<typeof api.alterarUsuario>[1]) => {
    try {
      await api.alterarUsuario(u.id, d);
      carregar();
    } catch (e) {
      alert(msgErro(e));
    }
  };

  const redefinir = (u: UsuarioPublico) => {
    const s = prompt(`Nova senha para ${u.nome} (mínimo 8 caracteres):`);
    if (s) void alterar(u, { senha: s });
  };

  return (
    <Card
      titulo="Usuários"
      subtitulo="Quem pode acessar a estância (capataz, tratadores, escritório)"
      flush
      acoes={<button className="btn small" onClick={() => setNovo({ aberto: true, nome: '', email: '', senha: '', papel: 'membro' })}><Icone nome="mais" tamanho={14} />Usuário</button>}
    >
      {erro ? <Vazio titulo="Não foi possível carregar">{erro}</Vazio> : !lista ? <Vazio titulo="Carregando…" /> : (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'inativo'}>
                  <td>{u.nome}{u.id === eu.id && <span className="muted small"> (você)</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.papel} disabled={u.id === eu.id} onChange={(e) => void alterar(u, { papel: e.target.value as Papel })} style={{ width: 'auto' }}>
                      <option value="admin">Administrador</option>
                      <option value="membro">Membro</option>
                    </select>
                  </td>
                  <td><Badge tom={u.ativo ? 'verde' : 'neutro'}>{u.ativo ? 'ativo' : 'desativado'}</Badge></td>
                  <td className="acoes">
                    {u.id !== eu.id && (
                      <>
                        <button className="btn small ghost" onClick={() => redefinir(u)}>Nova senha</button>
                        <button className="btn small ghost" onClick={() => void alterar(u, { ativo: !u.ativo })}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ padding: '8px 18px 14px', margin: 0 }}>
        Administradores gerenciam usuários, backups e a limpeza de dados. Membros registram e consultam todo o restante.
      </p>
      <ModalForm aberto={novo.aberto} titulo="Novo usuário" onFechar={() => setNovo({ ...novo, aberto: false })} onSalvar={criar}>
        <Campo rotulo="Nome" full><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required autoFocus /></Campo>
        <Campo rotulo="E-mail (login)"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required /></Campo>
        <Campo rotulo="Senha inicial" dica="Mínimo de 8 caracteres"><input type="text" minLength={8} value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required /></Campo>
        <Campo rotulo="Papel">
          <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Papel })}>
            <option value="membro">Membro</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
      </ModalForm>
    </Card>
  );
}

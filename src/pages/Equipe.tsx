import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { formatarData, hoje } from '@/lib/datas';
import { formatarMoeda } from '@/lib/formato';
import type { Funcionario } from '@/types';

const vazio = (): Omit<Funcionario, 'id'> => ({ nome: '', funcao: '', dataAdmissao: hoje(), salario: 0, ativo: true });

export default function Equipe() {
  const { funcionarios, adicionar, atualizar, remover } = useFazenda();
  const f = useFormulario(vazio);
  const ativos = funcionarios.filter((x) => x.ativo);

  const salvar = () => {
    if (!f.valores.nome.trim()) return alert('Informe o nome.');
    const { nome, funcao, telefone, dataAdmissao, salario, ativo } = f.valores;
    const dados = { nome, funcao, telefone, dataAdmissao, salario, ativo };
    if (f.editandoId) atualizar('funcionarios', f.editandoId, dados);
    else adicionar('funcionarios', dados);
    f.fechar();
  };

  const lancarFolha = () => {
    if (!ativos.length) return;
    const total = ativos.reduce((t, x) => t + x.salario, 0);
    if (!confirm(`Lançar a folha de pagamento (${formatarMoeda(total)}) como despesa de hoje?`)) return;
    adicionar('lancamentos', { tipo: 'despesa', categoria: 'Mão de obra', atividade: 'geral', descricao: `Folha de pagamento (${ativos.length} funcionário(s))`, valor: total, data: hoje(), pago: false });
  };

  return (
    <div className="stack">
      <PageHeader titulo="Equipe" subtitulo="Funcionários e peões da estância">
        <button className="btn" onClick={lancarFolha}>Lançar folha no financeiro</button>
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Novo funcionário</button>
      </PageHeader>
      <div className="grid stats">
        <Stat rotulo="Funcionários ativos" valor={ativos.length} />
        <Stat rotulo="Folha mensal" valor={formatarMoeda(ativos.reduce((t, x) => t + x.salario, 0))} />
      </div>
      <Card flush>
        {funcionarios.length === 0 ? <Vazio titulo="Nenhum funcionário cadastrado" /> : (
          <div className="table-wrap">
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Função</th><th>Telefone</th><th>Admissão</th><th className="num">Salário</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {funcionarios.map((x) => (
                  <tr key={x.id} className={x.ativo ? '' : 'inativo'}>
                    <td><strong>{x.nome}</strong></td>
                    <td>{x.funcao}</td>
                    <td>{x.telefone ?? '—'}</td>
                    <td>{formatarData(x.dataAdmissao)}</td>
                    <td className="num">{formatarMoeda(x.salario)}</td>
                    <td><Badge tom={x.ativo ? 'verde' : 'neutro'}>{x.ativo ? 'ativo' : 'desligado'}</Badge></td>
                    <td className="acoes"><BotoesLinha onEditar={() => f.abrir(x)} onExcluir={() => remover('funcionarios', x.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar funcionário' : 'Novo funcionário'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Nome *" full><input {...f.campo('nome')} required autoFocus /></Campo>
        <Campo rotulo="Função"><input {...f.campo('funcao')} placeholder="Capataz, peão, tratador…" /></Campo>
        <Campo rotulo="Telefone"><input {...f.campo('telefone')} /></Campo>
        <Campo rotulo="Admissão"><input type="date" {...f.campo('dataAdmissao')} /></Campo>
        <Campo rotulo="Salário (R$)"><input type="number" min={0} step="0.01" {...f.campo('salario')} /></Campo>
        <label className="check full"><input type="checkbox" checked={f.valores.ativo} onChange={(e) => f.definir('ativo', e.target.checked)} />Funcionário ativo</label>
      </ModalForm>
    </div>
  );
}

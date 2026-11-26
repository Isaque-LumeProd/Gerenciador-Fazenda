import { useMemo, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoBarras } from '@/components/Graficos';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { formatarData, hoje, mesAno, rotuloMes, ultimosMeses } from '@/lib/datas';
import { formatarMoeda, formatarNumero, formatarPct } from '@/lib/formato';
import type { Atividade, Lancamento } from '@/types';

export const CATEGORIAS_RECEITA = ['Venda de gado', 'Venda de leite', 'Venda de ovos', 'Venda de aves', 'Venda de esterco', 'Arrendamento', 'Outras receitas'];
export const CATEGORIAS_DESPESA = ['Ração', 'Sal mineral', 'Sanidade', 'Mão de obra', 'Combustível', 'Manutenção', 'Compra de animais', 'Energia', 'Impostos', 'Insumos', 'Outras despesas'];

const vazio = (): Omit<Lancamento, 'id'> => ({ tipo: 'despesa', categoria: 'Ração', atividade: 'geral', descricao: '', valor: 0, data: hoje(), pago: true });

type Periodo = 'mes' | '3m' | '12m' | 'ano' | 'tudo';

export default function Financeiro() {
  const { lancamentos, adicionar, atualizar, remover } = useFazenda();
  const f = useFormulario(vazio);
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [tipo, setTipo] = useState('');
  const [atividade, setAtividade] = useState('');
  const [pendentes, setPendentes] = useState(false);
  const H = hoje();

  const noPeriodo = useMemo(() => {
    const meses = periodo === 'mes' ? ultimosMeses(1) : periodo === '3m' ? ultimosMeses(3) : periodo === '12m' ? ultimosMeses(12) : null;
    return lancamentos.filter((l) => {
      if (meses) return meses.includes(mesAno(l.data));
      if (periodo === 'ano') return l.data.slice(0, 4) === H.slice(0, 4);
      return true;
    });
  }, [lancamentos, periodo, H]);

  const filtrados = noPeriodo
    .filter((l) => (!tipo || l.tipo === tipo) && (!atividade || l.atividade === atividade) && (!pendentes || !l.pago))
    .sort((a, b) => b.data.localeCompare(a.data));

  const soma = (ls: Lancamento[], t: Lancamento['tipo']) => ls.filter((l) => l.tipo === t).reduce((s, l) => s + l.valor, 0);
  const base = noPeriodo.filter((l) => !atividade || l.atividade === atividade);
  const receitas = soma(base, 'receita');
  const despesas = soma(base, 'despesa');
  const aPagar = lancamentos.filter((l) => l.tipo === 'despesa' && !l.pago).reduce((s, l) => s + l.valor, 0);
  const aReceber = lancamentos.filter((l) => l.tipo === 'receita' && !l.pago).reduce((s, l) => s + l.valor, 0);

  const mensal = useMemo(
    () =>
      ultimosMeses(12).map((m) => {
        const ls = lancamentos.filter((l) => mesAno(l.data) === m && (!atividade || l.atividade === atividade));
        return { mes: rotuloMes(m), receitas: soma(ls, 'receita'), despesas: soma(ls, 'despesa') };
      }),
    [lancamentos, atividade],
  );

  const porCategoria = (t: Lancamento['tipo']) => {
    const mapa = new Map<string, number>();
    for (const l of base.filter((x) => x.tipo === t)) mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + l.valor);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };

  const porAtividade = (['bovinos', 'aves', 'geral'] as Atividade[]).map((a) => {
    const ls = noPeriodo.filter((l) => l.atividade === a);
    return { a, r: soma(ls, 'receita'), d: soma(ls, 'despesa') };
  });

  const salvar = () => {
    const v = f.valores;
    if (!(v.valor > 0)) return alert('Informe o valor.');
    const dados = { tipo: v.tipo, categoria: v.categoria, atividade: v.atividade, descricao: v.descricao || v.categoria, valor: v.valor, data: v.data, pago: v.pago };
    if (f.editandoId) atualizar('lancamentos', f.editandoId, dados);
    else adicionar('lancamentos', dados);
    f.fechar();
  };

  const categorias = f.valores.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <div className="stack">
      <PageHeader titulo="Financeiro" subtitulo="Receitas, despesas e resultado por atividade">
        <button className="btn" onClick={() => f.abrir({ tipo: 'receita', categoria: CATEGORIAS_RECEITA[0] })}>+ Receita</button>
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Despesa</button>
      </PageHeader>

      <div className="filtros">
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          <option value="mes">Mês atual</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="ano">Ano corrente</option>
          <option value="tudo">Todo o período</option>
        </select>
        <select value={atividade} onChange={(e) => setAtividade(e.target.value)}>
          <option value="">Todas as atividades</option>
          <option value="bovinos">Bovinos</option>
          <option value="aves">Aves</option>
          <option value="geral">Geral</option>
        </select>
      </div>

      <div className="grid stats">
        <Stat rotulo="Receitas" valor={formatarMoeda(receitas)} />
        <Stat rotulo="Despesas" valor={formatarMoeda(despesas)} />
        <Stat rotulo="Resultado" valor={formatarMoeda(receitas - despesas)} tom={receitas - despesas >= 0 ? 'positivo' : 'negativo'} sub={receitas ? `Margem ${formatarPct((receitas - despesas) / receitas)}` : undefined} />
        <Stat rotulo="A pagar / a receber" valor={formatarMoeda(aPagar)} sub={`A receber: ${formatarMoeda(aReceber)}`} />
      </div>

      <Card titulo="Fluxo mensal" subtitulo={`Últimos 12 meses${atividade ? ' · ' + atividade : ''}`}>
        <GraficoBarras
          dados={mensal}
          x="mes"
          series={[{ chave: 'receitas', rotulo: 'Receitas', slot: 1 }, { chave: 'despesas', rotulo: 'Despesas', slot: 2 }]}
          formatar={(v) => (Math.abs(v) >= 1000 ? `R$ ${formatarNumero(v / 1000)}k` : formatarMoeda(v))}
        />
      </Card>

      <div className="grid cols-3">
        <Card titulo="Resultado por atividade">
          <div className="table-wrap">
          <table className="tabela">
            <thead><tr><th>Atividade</th><th className="num">Receitas</th><th className="num">Despesas</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {porAtividade.map(({ a, r, d }) => (
                <tr key={a}><td style={{ textTransform: 'capitalize' }}>{a}</td><td className="num">{formatarMoeda(r)}</td><td className="num">{formatarMoeda(d)}</td><td className="num" style={{ color: r - d >= 0 ? 'var(--primary)' : 'var(--danger)' }}>{formatarMoeda(r - d)}</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        {(['receita', 'despesa'] as const).map((t) => {
          const lista = porCategoria(t);
          const total = lista.reduce((s, [, v]) => s + v, 0);
          return (
            <Card key={t} titulo={t === 'receita' ? 'Receitas por categoria' : 'Despesas por categoria'}>
              {lista.length === 0 ? <Vazio titulo="Sem lançamentos" /> : (
                <div className="table-wrap">
                <table className="tabela">
                  <tbody>
                    {lista.map(([c, v]) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td style={{ width: '35%' }}><div className="barra"><div style={{ width: `${(v / total) * 100}%`, background: `var(--chart-${t === 'receita' ? 1 : 2})` }} /></div></td>
                        <td className="num">{formatarMoeda(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card titulo="Lançamentos" flush acoes={
        <div className="filtros" style={{ margin: 0 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Receitas e despesas</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <label className="check"><input type="checkbox" checked={pendentes} onChange={(e) => setPendentes(e.target.checked)} />Só pendentes</label>
        </div>
      }>
        {filtrados.length === 0 ? <Vazio titulo="Nenhum lançamento no filtro" /> : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="tabela">
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Atividade</th><th className="num">Valor</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {filtrados.map((l) => (
                  <tr key={l.id}>
                    <td>{formatarData(l.data)}</td>
                    <td>{l.descricao}</td>
                    <td>{l.categoria}</td>
                    <td style={{ textTransform: 'capitalize' }}>{l.atividade}</td>
                    <td className="num" style={{ color: l.tipo === 'receita' ? 'var(--primary)' : 'var(--danger)' }}>{l.tipo === 'receita' ? '+' : '−'} {formatarMoeda(l.valor)}</td>
                    <td>
                      <button className="btn small ghost" onClick={() => atualizar('lancamentos', l.id, { pago: !l.pago })} title="Alternar situação">
                        {l.pago ? <Badge tom="verde">{l.tipo === 'receita' ? 'recebido' : 'pago'}</Badge> : <Badge tom={l.data < H ? 'vermelho' : 'amarelo'}>{l.data < H ? 'vencido' : 'pendente'}</Badge>}
                      </button>
                    </td>
                    <td className="acoes"><BotoesLinha onEditar={() => f.abrir(l)} onExcluir={() => remover('lancamentos', l.id)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Saldo do filtro</td><td className="num">{formatarMoeda(soma(filtrados, 'receita') - soma(filtrados, 'despesa'))}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar lançamento' : f.valores.tipo === 'receita' ? 'Nova receita' : 'Nova despesa'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Tipo">
          <select value={f.valores.tipo} onChange={(e) => {
            const t = e.target.value as Lancamento['tipo'];
            f.setValores((v) => ({ ...v, tipo: t, categoria: (t === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA)[0] }));
          }}>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </Campo>
        <Campo rotulo="Categoria">
          <input list="cats-fin" {...f.campo('categoria')} />
          <datalist id="cats-fin">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <Campo rotulo="Atividade">
          <select {...f.campo('atividade')}><option value="bovinos">Bovinos</option><option value="aves">Aves</option><option value="geral">Geral</option></select>
        </Campo>
        <Campo rotulo="Valor (R$)"><input type="number" min={0} step="0.01" {...f.campo('valor')} required /></Campo>
        <Campo rotulo="Descrição" full><input {...f.campo('descricao')} /></Campo>
        <Campo rotulo="Data / vencimento"><input type="date" {...f.campo('data')} required /></Campo>
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 8 }}>
          <input type="checkbox" checked={f.valores.pago} onChange={(e) => f.definir('pago', e.target.checked)} />
          {f.valores.tipo === 'receita' ? 'Já recebido' : 'Já pago'}
        </label>
      </ModalForm>
    </div>
  );
}

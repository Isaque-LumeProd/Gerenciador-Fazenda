import { useEffect, useMemo, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Badge, Barra, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { formatarData, hoje } from '@/lib/datas';
import { formatarMoeda, formatarNumero } from '@/lib/formato';
import type { Atividade, CategoriaEstoque, ItemEstoque } from '@/types';

const CATEGORIAS: CategoriaEstoque[] = ['ração', 'sal mineral', 'medicamento', 'vacina', 'combustível', 'ferramenta', 'outros'];
const vazio = (): Omit<ItemEstoque, 'id'> => ({ nome: '', categoria: 'ração', unidade: 'kg', quantidade: 0, estoqueMinimo: 0, custoUnitario: 0 });

function ModalMovimento({ item, tipo, onFechar }: { item?: ItemEstoque; tipo: 'entrada' | 'saída'; onFechar: () => void }) {
  const { movimentarEstoque, adicionar } = useFazenda();
  const [qtd, setQtd] = useState('');
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState('');
  const [lancar, setLancar] = useState(true);
  const [custo, setCusto] = useState('');
  const [atividade, setAtividade] = useState<Atividade>('geral');

  useEffect(() => {
    setQtd(''); setData(hoje()); setObs(''); setLancar(true);
    setCusto(item ? String(item.custoUnitario) : '');
    setAtividade(item?.categoria === 'ração' ? 'aves' : item?.categoria === 'sal mineral' ? 'bovinos' : 'geral');
  }, [item, tipo]);

  if (!item) return null;
  const salvar = () => {
    const q = Number(qtd);
    if (!(q > 0)) return alert('Informe a quantidade.');
    if (tipo === 'saída' && q > item.quantidade && !confirm(`A saída (${q}) é maior que o saldo (${item.quantidade}). Continuar?`)) return;
    movimentarEstoque({ itemId: item.id, tipo, quantidade: q, data, observacoes: obs || undefined });
    if (tipo === 'entrada' && lancar && Number(custo) > 0) {
      adicionar('lancamentos', {
        tipo: 'despesa', categoria: item.categoria === 'ração' ? 'Ração' : item.categoria === 'combustível' ? 'Combustível' : item.categoria === 'vacina' || item.categoria === 'medicamento' ? 'Sanidade' : item.categoria === 'sal mineral' ? 'Sal mineral' : 'Insumos',
        atividade, descricao: `Compra: ${q} ${item.unidade} de ${item.nome}`, valor: q * Number(custo), data, pago: true,
      });
    }
    onFechar();
  };

  return (
    <ModalForm aberto titulo={`${tipo === 'entrada' ? 'Entrada' : 'Saída'} — ${item.nome}`} onFechar={onFechar} onSalvar={salvar} textoSalvar="Registrar">
      <Campo rotulo={`Quantidade (${item.unidade})`} dica={`Saldo atual: ${formatarNumero(item.quantidade)} ${item.unidade}`}>
        <input type="number" min={0} step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} autoFocus required />
      </Campo>
      <Campo rotulo="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      <Campo rotulo={tipo === 'entrada' ? 'Fornecedor / nota fiscal' : 'Destino / uso'} full><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      {tipo === 'entrada' && (
        <>
          <label className="check full"><input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />Lançar despesa no financeiro</label>
          {lancar && (
            <>
              <Campo rotulo="Custo unitário (R$)" dica={Number(qtd) > 0 && Number(custo) > 0 ? `Total: ${formatarMoeda(Number(qtd) * Number(custo))}` : undefined}>
                <input type="number" min={0} step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} />
              </Campo>
              <Campo rotulo="Atividade">
                <select value={atividade} onChange={(e) => setAtividade(e.target.value as Atividade)}>
                  <option value="bovinos">Bovinos</option><option value="aves">Aves</option><option value="geral">Geral</option>
                </select>
              </Campo>
            </>
          )}
        </>
      )}
    </ModalForm>
  );
}

export default function Estoque() {
  const { estoque, movimentosEstoque, adicionar, atualizar, remover, removerMovimento } = useFazenda();
  const f = useFormulario(vazio);
  const [mov, setMov] = useState<{ item?: ItemEstoque; tipo: 'entrada' | 'saída' }>({ tipo: 'entrada' });
  const [aba, setAba] = useState<'itens' | 'movimentos'>('itens');
  const [cat, setCat] = useState('');

  const itens = useMemo(() => estoque.filter((i) => !cat || i.categoria === cat).sort((a, b) => a.nome.localeCompare(b.nome)), [estoque, cat]);
  const valorTotal = estoque.reduce((t, i) => t + i.quantidade * i.custoUnitario, 0);
  const abaixo = estoque.filter((i) => i.quantidade <= i.estoqueMinimo).length;
  const nome = new Map(estoque.map((i) => [i.id, i]));
  const movimentos = [...movimentosEstoque].sort((a, b) => b.data.localeCompare(a.data));

  const salvar = () => {
    if (!f.valores.nome.trim()) return alert('Informe o nome do item.');
    const { nome: n, categoria, unidade, quantidade, estoqueMinimo, custoUnitario } = f.valores;
    const dados = { nome: n, categoria, unidade, quantidade, estoqueMinimo, custoUnitario };
    if (f.editandoId) atualizar('estoque', f.editandoId, dados);
    else adicionar('estoque', dados);
    f.fechar();
  };

  return (
    <div className="stack">
      <PageHeader titulo="Estoque de insumos" subtitulo="Ração, sal mineral, vacinas, medicamentos, combustível e ferramentas">
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Novo item</button>
      </PageHeader>
      <div className="grid stats">
        <Stat rotulo="Itens cadastrados" valor={estoque.length} />
        <Stat rotulo="Valor em estoque" valor={formatarMoeda(valorTotal)} />
        <Stat rotulo="Abaixo do mínimo" valor={abaixo} tom={abaixo ? 'negativo' : undefined} sub="Necessitam reposição" />
      </div>
      <div className="tabs">
        <button className={aba === 'itens' ? 'active' : ''} onClick={() => setAba('itens')}>Itens</button>
        <button className={aba === 'movimentos' ? 'active' : ''} onClick={() => setAba('movimentos')}>Movimentações</button>
      </div>
      {aba === 'itens' ? (
        <Card flush>
          <div style={{ padding: '14px 18px 0' }} className="filtros">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {itens.length === 0 ? <Vazio titulo="Nenhum item" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Item</th><th>Categoria</th><th className="num">Saldo</th><th className="num">Mínimo</th><th style={{ minWidth: 120 }}>Nível</th><th className="num">Custo unit.</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>
                  {itens.map((i) => {
                    const baixo = i.quantidade <= i.estoqueMinimo;
                    return (
                      <tr key={i.id}>
                        <td><strong>{i.nome}</strong> {baixo && <Badge tom="vermelho">repor</Badge>}</td>
                        <td style={{ textTransform: 'capitalize' }}>{i.categoria}</td>
                        <td className="num">{formatarNumero(i.quantidade)} {i.unidade}</td>
                        <td className="num">{formatarNumero(i.estoqueMinimo)}</td>
                        <td><Barra valor={i.quantidade} max={Math.max(i.estoqueMinimo * 2, i.quantidade, 1)} nivel={baixo ? 'critico' : i.quantidade <= i.estoqueMinimo * 1.3 ? 'alerta' : undefined} /></td>
                        <td className="num">{formatarMoeda(i.custoUnitario)}</td>
                        <td className="num">{formatarMoeda(i.quantidade * i.custoUnitario)}</td>
                        <td className="acoes">
                          <button className="btn small ghost" onClick={() => setMov({ item: i, tipo: 'entrada' })}>+ Entrada</button>
                          <button className="btn small ghost" onClick={() => setMov({ item: i, tipo: 'saída' })}>− Saída</button>
                          <BotoesLinha onEditar={() => f.abrir(i)} onExcluir={() => remover('estoque', i.id)} confirmacao={`Excluir ${i.nome} e suas movimentações?`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card flush>
          {movimentos.length === 0 ? <Vazio titulo="Nenhuma movimentação" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th className="num">Quantidade</th><th>Obs.</th><th /></tr></thead>
                <tbody>
                  {movimentos.map((m) => {
                    const it = nome.get(m.itemId);
                    return (
                      <tr key={m.id}>
                        <td>{formatarData(m.data)}</td>
                        <td>{it?.nome ?? '—'}</td>
                        <td><Badge tom={m.tipo === 'entrada' ? 'verde' : 'marrom'}>{m.tipo}</Badge></td>
                        <td className="num">{m.tipo === 'entrada' ? '+' : '−'}{formatarNumero(m.quantidade)} {it?.unidade}</td>
                        <td className="muted">{m.observacoes}</td>
                        <td className="acoes"><BotoesLinha onExcluir={() => removerMovimento(m.id)} confirmacao="Excluir a movimentação? O saldo do item será ajustado." /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar item' : 'Novo item de estoque'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Nome *" full><input {...f.campo('nome')} required autoFocus /></Campo>
        <Campo rotulo="Categoria"><select {...f.campo('categoria')}>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Campo>
        <Campo rotulo="Unidade"><input {...f.campo('unidade')} placeholder="kg, saco, dose, L…" /></Campo>
        <Campo rotulo="Saldo atual" dica={f.editandoId ? 'Prefira registrar entradas e saídas' : undefined}><input type="number" min={0} step="any" {...f.campo('quantidade')} /></Campo>
        <Campo rotulo="Estoque mínimo"><input type="number" min={0} step="any" {...f.campo('estoqueMinimo')} /></Campo>
        <Campo rotulo="Custo unitário (R$)"><input type="number" min={0} step="0.01" {...f.campo('custoUnitario')} /></Campo>
      </ModalForm>
      <ModalMovimento item={mov.item} tipo={mov.tipo} onFechar={() => setMov({ tipo: 'entrada' })} />
    </div>
  );
}

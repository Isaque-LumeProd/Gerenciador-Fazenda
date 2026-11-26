import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { BotoesLinha, Campo, Card, Modal, ModalForm, PageHeader, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useBovinosDerivados, rotuloBovino } from '@/lib/hooks';
import { formatarData, hoje } from '@/lib/datas';
import { formatarNumero, formatarNumero2 } from '@/lib/formato';
import { gmd, pesagensDoAnimal, arrobas } from '@/lib/zootecnia';
import type { Pesagem } from '@/types';

export function ModalPesagem({ aberto, inicial, onFechar }: { aberto: boolean; inicial?: Partial<Pesagem>; onFechar: () => void }) {
  const { bovinos, adicionar, atualizar } = useFazenda();
  const [v, setV] = useState<Omit<Pesagem, 'id'>>({ bovinoId: '', data: hoje(), pesoKg: 0 });
  useEffect(() => {
    if (aberto) setV({ bovinoId: '', data: hoje(), pesoKg: 0, ...inicial });
  }, [aberto, inicial]);
  const ativos = bovinos.filter((b) => b.status === 'ativo' || b.id === v.bovinoId);

  const salvar = () => {
    if (!v.bovinoId) return alert('Selecione o animal.');
    if (!(v.pesoKg > 0)) return alert('Informe um peso válido.');
    const dados = { bovinoId: v.bovinoId, data: v.data, pesoKg: v.pesoKg, observacoes: v.observacoes || undefined };
    if (inicial?.id) atualizar('pesagens', inicial.id, dados);
    else adicionar('pesagens', dados);
    onFechar();
  };

  return (
    <ModalForm aberto={aberto} titulo={inicial?.id ? 'Editar pesagem' : 'Nova pesagem'} onFechar={onFechar} onSalvar={salvar}>
      <Campo rotulo="Animal" full>
        <select value={v.bovinoId} onChange={(e) => setV({ ...v, bovinoId: e.target.value })} required>
          <option value="">Selecione…</option>
          {ativos.sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true })).map((b) => (
            <option key={b.id} value={b.id}>{rotuloBovino(b)}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} required />
      </Campo>
      <Campo rotulo="Peso (kg)">
        <input type="number" min={0} step="0.1" value={v.pesoKg || ''} onChange={(e) => setV({ ...v, pesoKg: Number(e.target.value) })} required />
      </Campo>
      <Campo rotulo="Observações" full>
        <input value={v.observacoes ?? ''} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
      </Campo>
    </ModalForm>
  );
}

/** Pesagem de vários animais de uma vez (ex.: um pasto inteiro no tronco). */
function ModalPesagemLote({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { pastos, adicionar } = useFazenda();
  const bovinos = useBovinosDerivados();
  const [pasto, setPasto] = useState('');
  const [data, setData] = useState(hoje());
  const [pesos, setPesos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (aberto) {
      setPesos({});
      setData(hoje());
    }
  }, [aberto]);

  const lista = bovinos
    .filter((b) => b.status === 'ativo' && (!pasto || b.pastoId === pasto))
    .sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true }));

  const salvar = () => {
    let n = 0;
    for (const b of lista) {
      const p = Number(pesos[b.id]);
      if (p > 0) {
        adicionar('pesagens', { bovinoId: b.id, data, pesoKg: p });
        n++;
      }
    }
    if (!n) return alert('Informe ao menos um peso.');
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      titulo="Pesagem em lote"
      onFechar={onFechar}
      largura={720}
      rodape={
        <>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primary" onClick={salvar}>Salvar pesagens</button>
        </>
      }
    >
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <Campo rotulo="Pasto">
          <select value={pasto} onChange={(e) => setPasto(e.target.value)}>
            <option value="">Todos os animais ativos</option>
            {pastos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data da pesagem">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      </div>
      <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <table className="tabela">
          <thead><tr><th>Animal</th><th>Categoria</th><th className="num">Último peso</th><th style={{ width: 140 }}>Novo peso (kg)</th></tr></thead>
          <tbody>
            {lista.map((b) => (
              <tr key={b.id}>
                <td>{rotuloBovino(b)}</td>
                <td style={{ textTransform: 'capitalize' }}>{b.categoria}</td>
                <td className="num">{b.peso ? `${b.peso} kg` : '—'}</td>
                <td><input type="number" min={0} step="0.1" value={pesos[b.id] ?? ''} onChange={(e) => setPesos({ ...pesos, [b.id]: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function Pesagens() {
  const { pesagens, bovinos, remover } = useFazenda();
  const [modal, setModal] = useState<{ aberto: boolean; inicial?: Partial<Pesagem> }>({ aberto: false });
  const [lote, setLote] = useState(false);
  const [busca, setBusca] = useState('');

  const linhas = useMemo(() => {
    const porId = new Map(bovinos.map((b) => [b.id, b]));
    const q = busca.trim().toLowerCase();
    return pesagens
      .map((p) => {
        const hist = pesagensDoAnimal(pesagens, p.bovinoId);
        const idx = hist.findIndex((x) => x.id === p.id);
        const anterior = idx > 0 ? hist[idx - 1] : undefined;
        return { ...p, animal: porId.get(p.bovinoId), ganho: anterior ? p.pesoKg - anterior.pesoKg : undefined, gmd: anterior ? gmd(anterior, p) : undefined };
      })
      .filter((p) => !q || p.animal?.brinco.toLowerCase().includes(q) || p.animal?.nome?.toLowerCase().includes(q))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [pesagens, bovinos, busca]);

  return (
    <div className="stack">
      <PageHeader titulo="Pesagens" subtitulo="Controle de peso, ganho médio diário (GMD) e arrobas">
        <button className="btn" onClick={() => setLote(true)}>Pesagem em lote</button>
        <button className="btn primary" onClick={() => setModal({ aberto: true })}><Icone nome="mais" tamanho={16} />Nova pesagem</button>
      </PageHeader>

      <Card flush>
        <div style={{ padding: '16px 18px 0' }}>
          <div className="filtros">
            <div className="busca"><input placeholder="Filtrar por brinco ou nome…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          </div>
        </div>
        {linhas.length === 0 ? (
          <Vazio titulo="Nenhuma pesagem registrada" />
        ) : (
          <div className="table-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Data</th><th>Animal</th><th className="num">Peso</th><th className="num">Arrobas</th><th className="num">Ganho</th><th className="num">GMD (kg/dia)</th><th>Obs.</th><th /></tr>
              </thead>
              <tbody>
                {linhas.slice(0, 300).map((p) => (
                  <tr key={p.id}>
                    <td>{formatarData(p.data)}</td>
                    <td>{p.animal ? <Link to={`/bovinos/${p.animal.id}`}>{rotuloBovino(p.animal)}</Link> : '—'}</td>
                    <td className="num">{formatarNumero(p.pesoKg)} kg</td>
                    <td className="num">{formatarNumero(arrobas(p.pesoKg))} @</td>
                    <td className="num">{p.ganho !== undefined ? `${p.ganho > 0 ? '+' : ''}${formatarNumero(p.ganho)} kg` : '—'}</td>
                    <td className="num">{p.gmd !== undefined ? formatarNumero2(p.gmd) : '—'}</td>
                    <td className="muted">{p.observacoes}</td>
                    <td className="acoes"><BotoesLinha onEditar={() => setModal({ aberto: true, inicial: p })} onExcluir={() => remover('pesagens', p.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ModalPesagem aberto={modal.aberto} inicial={modal.inicial} onFechar={() => setModal({ aberto: false })} />
      <ModalPesagemLote aberto={lote} onFechar={() => setLote(false)} />
    </div>
  );
}

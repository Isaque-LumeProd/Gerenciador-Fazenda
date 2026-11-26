import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Card, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { formatarData } from '@/lib/datas';
import { formatarNumero, formatarPct } from '@/lib/formato';
import { indicesLote } from '@/lib/zootecnia';
import { ModalLote, ModalRegistro } from './FormsAves';
import type { LoteAves } from '@/types';

export default function LotesAves() {
  const { lotesAves, registrosAves, remover } = useFazenda();
  const [modal, setModal] = useState<{ aberto: boolean; inicial?: Partial<LoteAves> }>({ aberto: false });
  const [registro, setRegistro] = useState<string | null>(null);
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const inicialRegistro = useMemo(() => (registro ? { loteId: registro } : undefined), [registro]);

  const lotes = useMemo(
    () =>
      lotesAves
        .filter((l) => mostrarEncerrados || l.status === 'ativo')
        .map((l) => ({ ...l, ind: indicesLote(l, registrosAves) }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [lotesAves, registrosAves, mostrarEncerrados],
  );
  const ativos = lotes.filter((l) => l.status === 'ativo');
  const vivas = ativos.reduce((t, l) => t + l.ind.avesVivas, 0);
  const poedeiras = ativos.filter((l) => l.finalidade === 'postura');
  const posturaMedia = poedeiras.reduce((t, l) => t + l.ind.posturaRecente * l.ind.avesVivas, 0) / (poedeiras.reduce((t, l) => t + l.ind.avesVivas, 0) || 1);

  return (
    <div className="stack">
      <PageHeader titulo="Lotes de aves" subtitulo="Galinhas de postura, frangos de corte e matrizes">
        <button className="btn" onClick={() => setRegistro('')}>Registro diário</button>
        <button className="btn primary" onClick={() => setModal({ aberto: true })}><Icone nome="mais" tamanho={16} />Novo lote</button>
      </PageHeader>
      <div className="grid stats">
        <Stat rotulo="Lotes ativos" valor={ativos.length} />
        <Stat rotulo="Aves alojadas" valor={formatarNumero(vivas)} />
        <Stat rotulo="Taxa de postura (7d)" valor={formatarPct(posturaMedia)} sub="Média ponderada dos lotes de postura" />
        <Stat rotulo="Ovos acumulados" valor={formatarNumero(ativos.reduce((t, l) => t + l.ind.ovosTotais, 0))} sub="Lotes ativos, desde o alojamento" />
      </div>
      <Card flush>
        <div style={{ padding: '14px 18px 0' }}>
          <label className="check"><input type="checkbox" checked={mostrarEncerrados} onChange={(e) => setMostrarEncerrados(e.target.checked)} />Mostrar lotes encerrados</label>
        </div>
        {lotes.length === 0 ? <Vazio titulo="Nenhum lote cadastrado" /> : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Lote</th><th>Finalidade</th><th>Raça</th><th>Galpão</th><th>Alojamento</th><th className="num">Idade</th>
                  <th className="num">Vivas</th><th className="num">Mortalidade</th><th className="num">Postura 7d</th><th className="num">Peso médio</th><th>Situação</th><th />
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className={l.status === 'encerrado' ? 'inativo' : ''}>
                    <td><Link to={`/aves/${l.id}`}><strong>{l.codigo}</strong></Link></td>
                    <td style={{ textTransform: 'capitalize' }}>{l.finalidade}</td>
                    <td>{l.raca}</td>
                    <td>{l.galpao}</td>
                    <td>{formatarData(l.dataAlojamento)}</td>
                    <td className="num">{Math.floor(l.ind.idadeDias / 7)} sem</td>
                    <td className="num">{l.ind.avesVivas}</td>
                    <td className="num">{formatarPct(l.ind.mortalidade)}</td>
                    <td className="num">{l.finalidade === 'corte' ? '—' : formatarPct(l.ind.posturaRecente)}</td>
                    <td className="num">{l.ind.pesoMedioG ? `${formatarNumero(l.ind.pesoMedioG)} g` : '—'}</td>
                    <td><Badge tom={l.status === 'ativo' ? 'verde' : 'neutro'}>{l.status}</Badge></td>
                    <td className="acoes">
                      {l.status === 'ativo' && <button className="btn small ghost" onClick={() => setRegistro(l.id)}>Registrar dia</button>}
                      <BotoesLinha onEditar={() => setModal({ aberto: true, inicial: l })} onExcluir={() => remover('lotesAves', l.id)} confirmacao={`Excluir o lote ${l.codigo} e todos os seus registros?`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ModalLote aberto={modal.aberto} inicial={modal.inicial} onFechar={() => setModal({ aberto: false })} />
      <ModalRegistro aberto={registro !== null} inicial={inicialRegistro} onFechar={() => setRegistro(null)} />
    </div>
  );
}

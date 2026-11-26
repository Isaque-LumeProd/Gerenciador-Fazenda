import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Card, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoLinha } from '@/components/Graficos';
import { Icone } from '@/components/Icone';
import { formatarData } from '@/lib/datas';
import { formatarMoeda, formatarNumero, formatarNumero2, formatarPct } from '@/lib/formato';
import { indicesLote, registrosDoLote } from '@/lib/zootecnia';
import { ModalLote, ModalRegistro } from './FormsAves';
import type { RegistroAves } from '@/types';

export default function LoteDetalhe() {
  const { id } = useParams();
  const s = useFazenda();
  const lote = s.lotesAves.find((l) => l.id === id);
  const [editar, setEditar] = useState(false);
  const [registro, setRegistro] = useState<{ aberto: boolean; inicial?: Partial<RegistroAves> }>({ aberto: false });

  const registros = useMemo(() => (id ? registrosDoLote(s.registrosAves, id) : []), [s.registrosAves, id]);

  const serie = useMemo(() => {
    if (!lote) return [];
    let vivas = lote.quantidadeInicial;
    return registros.map((r) => {
      vivas -= r.mortes;
      return {
        dia: formatarData(r.data).slice(0, 5),
        postura: vivas > 0 ? r.ovos / vivas : 0,
        peso: r.pesoMedioG ?? null,
        vivas,
      };
    });
  }, [registros, lote]);

  if (!lote) return <Vazio titulo="Lote não encontrado"><Link to="/aves">Voltar</Link></Vazio>;
  const ind = indicesLote(lote, s.registrosAves);
  const postura = lote.finalidade !== 'corte';
  const manejos = s.sanidade
    .filter((m) => m.especie === 'ave' && (m.alvoId === lote.id || m.alvo === 'rebanho'))
    .sort((a, b) => b.data.localeCompare(a.data));
  const receitaOvos = ((ind.ovosTotais - registros.reduce((t, r) => t + r.ovosDescarte, 0)) / 12) * s.config.precoDuziaOvos;

  return (
    <div className="stack">
      <div><Link to="/aves" className="btn small ghost"><Icone nome="voltar" tamanho={16} />Lotes</Link></div>
      <PageHeader
        titulo={`Lote ${lote.codigo}`}
        subtitulo={<>{lote.raca} · {lote.galpao} · <span style={{ textTransform: 'capitalize' }}>{lote.finalidade}</span> · alojado em {formatarData(lote.dataAlojamento)} · <Badge tom={lote.status === 'ativo' ? 'verde' : 'neutro'}>{lote.status}</Badge></>}
      >
        <button className="btn" onClick={() => setEditar(true)}><Icone nome="editar" tamanho={16} />Editar</button>
        {lote.status === 'ativo' && <button className="btn primary" onClick={() => setRegistro({ aberto: true, inicial: { loteId: lote.id } })}><Icone nome="mais" tamanho={16} />Registro diário</button>}
      </PageHeader>

      <div className="grid stats">
        <Stat rotulo="Aves vivas" valor={formatarNumero(ind.avesVivas)} sub={`de ${lote.quantidadeInicial} alojadas`} />
        <Stat rotulo="Idade" valor={`${Math.floor(ind.idadeDias / 7)} semanas`} sub={`${ind.idadeDias} dias`} />
        <Stat rotulo="Mortalidade acumulada" valor={formatarPct(ind.mortalidade)} sub={`${ind.mortesTotais} aves`} tom={ind.mortalidade > 0.05 ? 'negativo' : undefined} />
        {postura ? (
          <>
            <Stat rotulo="Taxa de postura (7d)" valor={formatarPct(ind.posturaRecente)} />
            <Stat rotulo="Ovos produzidos" valor={formatarNumero(ind.ovosTotais)} sub={`≈ ${formatarMoeda(receitaOvos)} a ${formatarMoeda(s.config.precoDuziaOvos)}/dúzia`} />
            <Stat rotulo="Ração por dúzia" valor={`${formatarNumero2(ind.racaoPorDuzia)} kg`} sub={`${formatarNumero(ind.racaoTotalKg)} kg consumidos`} />
          </>
        ) : (
          <>
            <Stat rotulo="Peso médio" valor={ind.pesoMedioG ? `${formatarNumero(ind.pesoMedioG)} g` : '—'} />
            <Stat rotulo="Conversão alimentar" valor={ind.conversaoAlimentar ? formatarNumero2(ind.conversaoAlimentar) : '—'} sub="kg de ração / kg de peso vivo" />
            <Stat rotulo="Ração consumida" valor={`${formatarNumero(ind.racaoTotalKg)} kg`} />
          </>
        )}
      </div>

      <Card titulo={postura ? 'Taxa de postura diária' : 'Peso médio das amostragens'}>
        {serie.length < 2 ? <Vazio titulo="Poucos registros" /> : postura ? (
          <GraficoLinha dados={serie} x="dia" series={[{ chave: 'postura', rotulo: 'Postura', slot: 1 }]} formatar={formatarPct} />
        ) : (
          <GraficoLinha dados={serie.filter((x) => x.peso)} x="dia" series={[{ chave: 'peso', rotulo: 'Peso médio (g)', slot: 1 }]} formatar={(v) => `${formatarNumero(v)} g`} />
        )}
      </Card>

      <div className="grid cols-2-1">
        <Card titulo="Registros diários" flush>
          {registros.length === 0 ? <Vazio titulo="Nenhum registro" /> : (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    {postura && <><th className="num">Ovos</th><th className="num">Descarte</th></>}
                    <th className="num">Mortes</th><th className="num">Ração</th>
                    {!postura && <th className="num">Peso</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...registros].reverse().map((r) => (
                    <tr key={r.id}>
                      <td>{formatarData(r.data)}</td>
                      {postura && <><td className="num">{r.ovos}</td><td className="num">{r.ovosDescarte}</td></>}
                      <td className="num">{r.mortes || '—'}</td>
                      <td className="num">{formatarNumero(r.racaoKg)} kg</td>
                      {!postura && <td className="num">{r.pesoMedioG ? `${r.pesoMedioG} g` : '—'}</td>}
                      <td className="acoes"><BotoesLinha onEditar={() => setRegistro({ aberto: true, inicial: r })} onExcluir={() => s.remover('registrosAves', r.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card titulo="Sanidade do lote" flush acoes={<Link to="/sanidade" className="small">Registrar</Link>}>
          {manejos.length === 0 ? <Vazio titulo="Nenhum manejo" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Produto</th><th>Próxima</th></tr></thead>
                <tbody>
                  {manejos.map((m) => (
                    <tr key={m.id}><td>{formatarData(m.data)}</td><td>{m.produto}</td><td>{formatarData(m.proximaDose)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <ModalLote aberto={editar} inicial={lote} onFechar={() => setEditar(false)} />
      <ModalRegistro aberto={registro.aberto} inicial={registro.inicial} onFechar={() => setRegistro({ aberto: false })} />
    </div>
  );
}

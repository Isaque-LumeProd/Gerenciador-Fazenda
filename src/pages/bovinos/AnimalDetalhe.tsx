import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Card, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoLinha } from '@/components/Graficos';
import { Icone } from '@/components/Icone';
import { useBovinosDerivados, rotuloBovino } from '@/lib/hooks';
import { formatarData, formatarIdade, somarDias, hoje } from '@/lib/datas';
import { formatarMoeda, formatarNumero, formatarNumero2 } from '@/lib/formato';
import { arrobas, gmd, pesagensDoAnimal } from '@/lib/zootecnia';
import { ModalBovino, ModalSaida } from './FormsBovino';
import { ModalPesagem } from './Pesagens';
import { ModalEvento } from './Reproducao';
import { tomStatus } from './Rebanho';
import type { EventoReprodutivo, Pesagem } from '@/types';

export default function AnimalDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const s = useFazenda();
  const derivados = useBovinosDerivados();
  const animal = derivados.find((b) => b.id === id);
  const [editar, setEditar] = useState(false);
  const [saida, setSaida] = useState(false);
  const [pesagem, setPesagem] = useState<{ aberto: boolean; inicial?: Partial<Pesagem> }>({ aberto: false });
  const [evento, setEvento] = useState<{ aberto: boolean; inicial?: Partial<EventoReprodutivo> }>({ aberto: false });

  const pesagens = useMemo(() => (id ? pesagensDoAnimal(s.pesagens, id) : []), [s.pesagens, id]);
  if (!animal) return <Vazio titulo="Animal não encontrado"><Link to="/bovinos">Voltar ao rebanho</Link></Vazio>;

  const mae = s.bovinos.find((b) => b.id === animal.maeId);
  const filhos = s.bovinos.filter((b) => b.maeId === animal.id);
  const eventos = s.reproducao.filter((e) => e.femeaId === animal.id).sort((a, b) => b.data.localeCompare(a.data));
  const manejos = s.sanidade
    .filter((m) => m.especie === 'bovino' && (m.alvoId === animal.id || (m.alvo === 'rebanho' && m.data >= animal.dataNascimento)))
    .sort((a, b) => b.data.localeCompare(a.data));
  const carencia = manejos.find((m) => m.carenciaDias && somarDias(m.data, m.carenciaDias) >= hoje());

  const grafico = pesagens.map((p) => ({ data: formatarData(p.data), peso: p.pesoKg }));

  return (
    <div className="stack">
      <div>
        <button className="btn small ghost" onClick={() => navegar(-1)}><Icone nome="voltar" tamanho={16} />Voltar</button>
      </div>
      <PageHeader
        titulo={`Brinco ${animal.brinco}${animal.nome ? ' · ' + animal.nome : ''}`}
        subtitulo={<>{animal.raca} · {animal.sexo === 'F' ? 'Fêmea' : 'Macho'} · <span style={{ textTransform: 'capitalize' }}>{animal.categoria}</span> · <Badge tom={tomStatus[animal.status]}>{animal.status}</Badge>{carencia && <> <Badge tom="vermelho">em carência até {formatarData(somarDias(carencia.data, carencia.carenciaDias!))}</Badge></>}</>}
      >
        <button className="btn" onClick={() => setEditar(true)}><Icone nome="editar" tamanho={16} />Editar</button>
        {animal.status === 'ativo' && <button className="btn" onClick={() => setSaida(true)}>Registrar saída</button>}
      </PageHeader>

      <div className="grid stats">
        <Stat rotulo="Idade" valor={formatarIdade(animal.idadeMeses)} sub={`Nascido em ${formatarData(animal.dataNascimento)}`} />
        <Stat rotulo="Peso atual" valor={animal.peso ? `${formatarNumero(animal.peso)} kg` : '—'} sub={animal.peso ? `${formatarNumero(arrobas(animal.peso))} @ · ${formatarMoeda(arrobas(animal.peso) * s.config.precoArroba)}` : 'Sem pesagens'} />
        <Stat rotulo="GMD recente" valor={animal.gmd !== undefined ? `${formatarNumero2(animal.gmd)} kg/dia` : '—'} />
        <Stat rotulo="Pasto" valor={<span style={{ fontSize: '1.1rem' }}>{animal.pastoNome ?? '—'}</span>} />
      </div>

      <div className="grid cols-2-1">
        <Card titulo="Evolução de peso" acoes={<button className="btn small" onClick={() => setPesagem({ aberto: true, inicial: { bovinoId: animal.id } })}><Icone nome="mais" tamanho={14} />Pesagem</button>}>
          {grafico.length < 2 ? (
            <Vazio titulo="Poucas pesagens">Registre ao menos duas pesagens para ver a curva.</Vazio>
          ) : (
            <GraficoLinha dados={grafico} x="data" series={[{ chave: 'peso', rotulo: 'Peso (kg)', slot: 1 }]} formatar={(v) => `${formatarNumero(v)} kg`} />
          )}
        </Card>
        <Card titulo="Dados do animal">
          <dl className="dl">
            <dt>Finalidade</dt><dd style={{ textTransform: 'capitalize' }}>{animal.finalidade}</dd>
            <dt>Origem</dt><dd>{animal.origem === 'nascido' ? 'Nascido na estância' : 'Comprado'}</dd>
            <dt>Mãe</dt><dd>{mae ? <Link to={`/bovinos/${mae.id}`}>{rotuloBovino(mae)}</Link> : '—'}</dd>
            <dt>Pai</dt><dd>{animal.pai || '—'}</dd>
            {animal.status !== 'ativo' && (<><dt>Saída</dt><dd>{formatarData(animal.dataSaida)} {animal.motivoSaida && `— ${animal.motivoSaida}`}</dd></>)}
            {filhos.length > 0 && (<><dt>Crias</dt><dd>{filhos.map((f, i) => <span key={f.id}>{i > 0 && ', '}<Link to={`/bovinos/${f.id}`}>{f.brinco}</Link></span>)}</dd></>)}
            {animal.observacoes && (<><dt>Obs.</dt><dd>{animal.observacoes}</dd></>)}
          </dl>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card titulo="Pesagens" flush>
          {pesagens.length === 0 ? <Vazio titulo="Nenhuma pesagem" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th className="num">Peso</th><th className="num">GMD</th><th /></tr></thead>
                <tbody>
                  {[...pesagens].reverse().map((p, i, arr) => {
                    const ant = arr[i + 1];
                    const g = ant ? gmd(ant, p) : undefined;
                    return (
                      <tr key={p.id}>
                        <td>{formatarData(p.data)}</td>
                        <td className="num">{formatarNumero(p.pesoKg)} kg</td>
                        <td className="num">{g !== undefined ? formatarNumero2(g) : '—'}</td>
                        <td className="acoes"><BotoesLinha onEditar={() => setPesagem({ aberto: true, inicial: p })} onExcluir={() => s.remover('pesagens', p.id)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card titulo="Sanidade" flush acoes={<Link to="/sanidade" className="small">Registrar manejo</Link>}>
          {manejos.length === 0 ? <Vazio titulo="Nenhum manejo sanitário" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Aplicação</th></tr></thead>
                <tbody>
                  {manejos.map((m) => (
                    <tr key={m.id}>
                      <td>{formatarData(m.data)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{m.tipo}</td>
                      <td>{m.produto}</td>
                      <td className="muted">{m.alvo === 'rebanho' ? 'Rebanho' : 'Individual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {animal.sexo === 'F' && (
        <Card
          titulo="Histórico reprodutivo"
          subtitulo={animal.reproducao && `Situação atual: ${animal.reproducao.status}${animal.reproducao.partoPrevisto && (animal.reproducao.status === 'prenhe' || animal.reproducao.status === 'coberta') ? ` · parto previsto ${formatarData(animal.reproducao.partoPrevisto)}` : ''}`}
          flush
          acoes={<button className="btn small" onClick={() => setEvento({ aberto: true, inicial: { femeaId: animal.id } })}><Icone nome="mais" tamanho={14} />Evento</button>}
        >
          {eventos.length === 0 ? <Vazio titulo="Nenhum evento reprodutivo" /> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Evento</th><th>Detalhe</th><th /></tr></thead>
                <tbody>
                  {eventos.map((e) => (
                    <tr key={e.id}>
                      <td>{formatarData(e.data)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{e.tipo}</td>
                      <td>{e.touro ?? e.resultado ?? (e.bezerroId ? <Link to={`/bovinos/${e.bezerroId}`}>ver bezerro</Link> : '')}</td>
                      <td className="acoes"><BotoesLinha onEditar={() => setEvento({ aberto: true, inicial: e })} onExcluir={() => s.remover('reproducao', e.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ModalBovino aberto={editar} inicial={animal} onFechar={() => setEditar(false)} />
      {saida && <ModalSaida bovino={animal} onFechar={() => setSaida(false)} />}
      <ModalPesagem aberto={pesagem.aberto} inicial={pesagem.inicial} onFechar={() => setPesagem({ aberto: false })} />
      <ModalEvento aberto={evento.aberto} inicial={evento.inicial} onFechar={() => setEvento({ aberto: false })} />
    </div>
  );
}

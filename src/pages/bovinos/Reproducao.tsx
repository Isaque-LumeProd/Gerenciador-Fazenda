import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useBovinosDerivados, rotuloBovino } from '@/lib/hooks';
import { diffDias, formatarData, hoje, somarDias } from '@/lib/datas';
import { formatarNumero, formatarPct } from '@/lib/formato';
import { DIAS_GESTACAO, intervaloEntrePartos } from '@/lib/zootecnia';
import type { EventoReprodutivo, TipoEventoReprodutivo } from '@/types';

const TIPOS: TipoEventoReprodutivo[] = ['cobertura', 'inseminação', 'diagnóstico', 'parto', 'aborto'];

export function ModalEvento({ aberto, inicial, onFechar }: { aberto: boolean; inicial?: Partial<EventoReprodutivo>; onFechar: () => void }) {
  const { bovinos, reproducao, adicionar, atualizar } = useFazenda();
  const [v, setV] = useState<Omit<EventoReprodutivo, 'id'>>({ femeaId: '', tipo: 'cobertura', data: hoje() });
  const [bezerro, setBezerro] = useState({ cadastrar: true, brinco: '', sexo: 'F' as 'F' | 'M' });

  useEffect(() => {
    if (aberto) {
      setV({ femeaId: '', tipo: 'cobertura', data: hoje(), ...inicial });
      setBezerro({ cadastrar: true, brinco: '', sexo: 'F' });
    }
  }, [aberto, inicial]);

  const femeas = bovinos
    .filter((b) => b.sexo === 'F' && (b.status === 'ativo' || b.id === v.femeaId))
    .sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true }));
  const editando = !!inicial?.id;

  const salvar = () => {
    if (!v.femeaId) return alert('Selecione a fêmea.');
    const dados: Omit<EventoReprodutivo, 'id'> = {
      femeaId: v.femeaId,
      tipo: v.tipo,
      data: v.data,
      touro: v.tipo === 'cobertura' || v.tipo === 'inseminação' ? v.touro : undefined,
      resultado: v.tipo === 'diagnóstico' ? v.resultado ?? 'prenhe' : undefined,
      bezerroId: v.bezerroId,
      observacoes: v.observacoes || undefined,
    };
    if (!editando && v.tipo === 'parto' && bezerro.cadastrar) {
      if (!bezerro.brinco.trim()) return alert('Informe o brinco do bezerro ou desmarque o cadastro.');
      const mae = bovinos.find((b) => b.id === v.femeaId)!;
      const ultimaCob = reproducao
        .filter((e) => e.femeaId === v.femeaId && (e.tipo === 'cobertura' || e.tipo === 'inseminação'))
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      dados.bezerroId = adicionar('bovinos', {
        brinco: bezerro.brinco.trim(),
        raca: mae.raca,
        sexo: bezerro.sexo,
        dataNascimento: v.data,
        finalidade: 'corte',
        origem: 'nascido',
        maeId: mae.id,
        pai: ultimaCob?.touro,
        pastoId: mae.pastoId,
        status: 'ativo',
      });
    }
    if (editando) atualizar('reproducao', inicial!.id!, dados);
    else adicionar('reproducao', dados);
    onFechar();
  };

  return (
    <ModalForm aberto={aberto} titulo={editando ? 'Editar evento reprodutivo' : 'Novo evento reprodutivo'} onFechar={onFechar} onSalvar={salvar}>
      <Campo rotulo="Fêmea" full>
        <select value={v.femeaId} onChange={(e) => setV({ ...v, femeaId: e.target.value })} required>
          <option value="">Selecione…</option>
          {femeas.map((b) => <option key={b.id} value={b.id}>{rotuloBovino(b)}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Evento">
        <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoEventoReprodutivo })}>
          {TIPOS.map((t) => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} required />
      </Campo>
      {(v.tipo === 'cobertura' || v.tipo === 'inseminação') && (
        <Campo rotulo={v.tipo === 'cobertura' ? 'Touro' : 'Sêmen / touro'} full dica={`Parto previsto: ${formatarData(somarDias(v.data, DIAS_GESTACAO))}`}>
          <input value={v.touro ?? ''} onChange={(e) => setV({ ...v, touro: e.target.value })} />
        </Campo>
      )}
      {v.tipo === 'diagnóstico' && (
        <Campo rotulo="Resultado" full>
          <select value={v.resultado ?? 'prenhe'} onChange={(e) => setV({ ...v, resultado: e.target.value as 'prenhe' | 'vazia' })}>
            <option value="prenhe">Prenhe</option>
            <option value="vazia">Vazia</option>
          </select>
        </Campo>
      )}
      {v.tipo === 'parto' && !editando && (
        <>
          <label className="check full">
            <input type="checkbox" checked={bezerro.cadastrar} onChange={(e) => setBezerro({ ...bezerro, cadastrar: e.target.checked })} />
            Cadastrar o bezerro no rebanho
          </label>
          {bezerro.cadastrar && (
            <>
              <Campo rotulo="Brinco do bezerro">
                <input value={bezerro.brinco} onChange={(e) => setBezerro({ ...bezerro, brinco: e.target.value })} />
              </Campo>
              <Campo rotulo="Sexo do bezerro">
                <select value={bezerro.sexo} onChange={(e) => setBezerro({ ...bezerro, sexo: e.target.value as 'F' | 'M' })}>
                  <option value="F">Fêmea</option>
                  <option value="M">Macho</option>
                </select>
              </Campo>
            </>
          )}
        </>
      )}
      <Campo rotulo="Observações" full>
        <input value={v.observacoes ?? ''} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
      </Campo>
    </ModalForm>
  );
}

const tomRepro = { vazia: 'neutro', coberta: 'amarelo', prenhe: 'verde', parida: 'marrom' } as const;

export default function Reproducao() {
  const { reproducao, bovinos: todos, remover } = useFazenda();
  const bovinos = useBovinosDerivados();
  const [modal, setModal] = useState<{ aberto: boolean; inicial?: Partial<EventoReprodutivo> }>({ aberto: false });
  const [aba, setAba] = useState<'matrizes' | 'historico'>('matrizes');
  const H = hoje();

  const matrizes = useMemo(
    () =>
      bovinos
        .filter((b) => b.status === 'ativo' && (b.categoria === 'vaca' || b.categoria === 'novilha'))
        .map((b) => ({ ...b, iep: intervaloEntrePartos(reproducao, b.id) }))
        .sort((a, b) => (a.reproducao?.partoPrevisto ?? '9999').localeCompare(b.reproducao?.partoPrevisto ?? '9999')),
    [bovinos, reproducao],
  );

  const prenhes = matrizes.filter((m) => m.reproducao?.status === 'prenhe').length;
  const cobertas = matrizes.filter((m) => m.reproducao?.status === 'coberta').length;
  const partos90 = matrizes.filter((m) => {
    const p = m.reproducao?.partoPrevisto;
    return p && (m.reproducao?.status === 'prenhe' || m.reproducao?.status === 'coberta') && diffDias(H, p) <= 90;
  }).length;

  const diagnosticos = reproducao.filter((e) => e.tipo === 'diagnóstico' && diffDias(e.data, H) <= 365);
  const taxaPrenhez = diagnosticos.length ? diagnosticos.filter((d) => d.resultado === 'prenhe').length / diagnosticos.length : 0;
  const ieps = matrizes.map((m) => m.iep).filter((x): x is number => x !== undefined);
  const iepMedio = ieps.length ? ieps.reduce((a, b) => a + b, 0) / ieps.length : undefined;

  const porId = new Map(todos.map((b) => [b.id, b]));
  const historico = [...reproducao].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="stack">
      <PageHeader titulo="Reprodução" subtitulo="Coberturas, inseminações, diagnósticos de prenhez e partos">
        <button className="btn primary" onClick={() => setModal({ aberto: true })}><Icone nome="mais" tamanho={16} />Novo evento</button>
      </PageHeader>

      <div className="grid stats">
        <Stat rotulo="Matrizes (vacas e novilhas)" valor={matrizes.length} />
        <Stat rotulo="Prenhes" valor={prenhes} sub={`${cobertas} aguardando diagnóstico`} />
        <Stat rotulo="Taxa de prenhez (12m)" valor={formatarPct(taxaPrenhez)} sub={`${diagnosticos.length} diagnóstico(s)`} />
        <Stat rotulo="Partos nos próximos 90 dias" valor={partos90} />
        <Stat rotulo="Intervalo entre partos" valor={iepMedio ? `${formatarNumero(iepMedio)} dias` : '—'} sub="Média das matrizes" />
      </div>

      <div className="tabs">
        <button className={aba === 'matrizes' ? 'active' : ''} onClick={() => setAba('matrizes')}>Matrizes</button>
        <button className={aba === 'historico' ? 'active' : ''} onClick={() => setAba('historico')}>Histórico de eventos</button>
      </div>

      {aba === 'matrizes' ? (
        <Card flush>
          {matrizes.length === 0 ? (
            <Vazio titulo="Nenhuma vaca ou novilha ativa" />
          ) : (
            <div className="table-wrap">
              <table className="tabela">
                <thead>
                  <tr><th>Matriz</th><th>Categoria</th><th>Situação</th><th>Última cobertura</th><th>Parto previsto</th><th>Último parto</th><th className="num">IEP</th><th /></tr>
                </thead>
                <tbody>
                  {matrizes.map((m) => {
                    const r = m.reproducao!;
                    const dias = r.partoPrevisto ? diffDias(H, r.partoPrevisto) : undefined;
                    const gestando = r.status === 'prenhe' || r.status === 'coberta';
                    return (
                      <tr key={m.id}>
                        <td><Link to={`/bovinos/${m.id}`}>{rotuloBovino(m)}</Link></td>
                        <td style={{ textTransform: 'capitalize' }}>{m.categoria}</td>
                        <td><Badge tom={tomRepro[r.status]}>{r.status}</Badge></td>
                        <td>{formatarData(r.ultimaCobertura)}</td>
                        <td>
                          {gestando && r.partoPrevisto ? (
                            <>
                              {formatarData(r.partoPrevisto)}{' '}
                              <span className="muted small">({dias! >= 0 ? `em ${dias} d` : `há ${-dias!} d`})</span>
                            </>
                          ) : '—'}
                        </td>
                        <td>{formatarData(r.ultimoParto)}</td>
                        <td className="num">{m.iep ? `${formatarNumero(m.iep)} d` : '—'}</td>
                        <td className="acoes">
                          <button className="btn small ghost" onClick={() => setModal({ aberto: true, inicial: { femeaId: m.id, tipo: r.status === 'coberta' ? 'diagnóstico' : r.status === 'prenhe' ? 'parto' : 'cobertura' } })}>
                            Registrar
                          </button>
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
          {historico.length === 0 ? (
            <Vazio titulo="Nenhum evento registrado" />
          ) : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Fêmea</th><th>Evento</th><th>Detalhe</th><th>Obs.</th><th /></tr></thead>
                <tbody>
                  {historico.map((e) => {
                    const f = porId.get(e.femeaId);
                    const bz = e.bezerroId ? porId.get(e.bezerroId) : undefined;
                    return (
                      <tr key={e.id}>
                        <td>{formatarData(e.data)}</td>
                        <td>{f ? <Link to={`/bovinos/${f.id}`}>{rotuloBovino(f)}</Link> : '—'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{e.tipo}</td>
                        <td>
                          {e.touro && `Touro: ${e.touro}`}
                          {e.resultado && <Badge tom={e.resultado === 'prenhe' ? 'verde' : 'neutro'}>{e.resultado}</Badge>}
                          {bz && <>Bezerro: <Link to={`/bovinos/${bz.id}`}>{bz.brinco}</Link></>}
                        </td>
                        <td className="muted">{e.observacoes}</td>
                        <td className="acoes"><BotoesLinha onEditar={() => setModal({ aberto: true, inicial: e })} onExcluir={() => remover('reproducao', e.id)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <ModalEvento aberto={modal.aberto} inicial={modal.inicial} onFechar={() => setModal({ aberto: false })} />
    </div>
  );
}

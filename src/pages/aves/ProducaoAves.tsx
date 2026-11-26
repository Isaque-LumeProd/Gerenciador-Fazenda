import { useEffect, useMemo, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Card, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoBarras } from '@/components/Graficos';
import { diffDias, formatarData, hoje } from '@/lib/datas';
import { formatarMoeda, formatarNumero } from '@/lib/formato';
import { indicesLote } from '@/lib/zootecnia';

interface Linha { ovos: string; ovosDescarte: string; mortes: string; racaoKg: string }
const linhaVazia: Linha = { ovos: '', ovosDescarte: '', mortes: '', racaoKg: '' };

/** Lançamento rápido do dia para todos os lotes ativos + resumo diário. */
export default function ProducaoAves() {
  const { lotesAves, registrosAves, adicionar, atualizar, config } = useFazenda();
  const [data, setData] = useState(hoje());
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [salvo, setSalvo] = useState(false);
  const ativos = lotesAves.filter((l) => l.status === 'ativo').sort((a, b) => a.codigo.localeCompare(b.codigo));

  // Preenche com o que já foi registrado na data escolhida.
  useEffect(() => {
    const novo: Record<string, Linha> = {};
    for (const l of lotesAves) {
      const r = registrosAves.find((x) => x.loteId === l.id && x.data === data);
      novo[l.id] = r
        ? { ovos: String(r.ovos), ovosDescarte: String(r.ovosDescarte), mortes: String(r.mortes), racaoKg: String(r.racaoKg) }
        : { ...linhaVazia };
    }
    setLinhas(novo);
    setSalvo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const salvar = () => {
    const suspeitos = ativos.filter((l) => Number(linhas[l.id]?.ovos) > indicesLote(l, registrosAves).avesVivas);
    if (suspeitos.length && !confirm(`Mais ovos do que aves vivas em ${suspeitos.map((l) => l.codigo).join(', ')}. Salvar mesmo assim?`)) return;
    for (const l of ativos) {
      const ln = linhas[l.id];
      if (!ln || Object.values(ln).every((x) => x === '')) continue;
      const dados = { ovos: Number(ln.ovos) || 0, ovosDescarte: Number(ln.ovosDescarte) || 0, mortes: Number(ln.mortes) || 0, racaoKg: Number(ln.racaoKg) || 0 };
      const existente = registrosAves.find((x) => x.loteId === l.id && x.data === data);
      if (existente) atualizar('registrosAves', existente.id, dados);
      else adicionar('registrosAves', { loteId: l.id, data, ...dados });
    }
    setSalvo(true);
  };

  const H = hoje();
  const resumo = useMemo(() => {
    const mapa = new Map<string, { ovos: number; descarte: number; mortes: number; racao: number }>();
    for (const r of registrosAves) {
      if (diffDias(r.data, H) > 30 || diffDias(r.data, H) < 0) continue;
      const m = mapa.get(r.data) ?? { ovos: 0, descarte: 0, mortes: 0, racao: 0 };
      m.ovos += r.ovos; m.descarte += r.ovosDescarte; m.mortes += r.mortes; m.racao += r.racaoKg;
      mapa.set(r.data, m);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [registrosAves, H]);

  const ult7 = resumo.slice(0, 7);
  const ovos7 = ult7.reduce((t, [, m]) => t + m.ovos - m.descarte, 0);
  const grafico = [...resumo].reverse().map(([d, m]) => ({ dia: formatarData(d).slice(0, 5), duzias: Math.round(((m.ovos - m.descarte) / 12) * 10) / 10 }));

  const set = (loteId: string, k: keyof Linha, v: string) => setLinhas((x) => ({ ...x, [loteId]: { ...(x[loteId] ?? linhaVazia), [k]: v } }));

  return (
    <div className="stack">
      <PageHeader titulo="Produção diária das aves" subtitulo="Lance a coleta de ovos, mortes e ração de todos os lotes de uma vez" />
      <div className="grid stats">
        <Stat rotulo="Ovos aproveitáveis (7 dias)" valor={formatarNumero(ovos7)} sub={`${formatarNumero(ovos7 / 12)} dúzias`} />
        <Stat rotulo="Receita potencial (7 dias)" valor={formatarMoeda((ovos7 / 12) * config.precoDuziaOvos)} sub={`a ${formatarMoeda(config.precoDuziaOvos)} a dúzia`} />
        <Stat rotulo="Mortes (7 dias)" valor={ult7.reduce((t, [, m]) => t + m.mortes, 0)} />
        <Stat rotulo="Ração (7 dias)" valor={`${formatarNumero(ult7.reduce((t, [, m]) => t + m.racao, 0))} kg`} />
      </div>

      <Card titulo="Lançamento do dia" acoes={<input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ width: 'auto' }} />}>
        {ativos.length === 0 ? <Vazio titulo="Nenhum lote ativo" /> : (
          <>
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Lote</th><th className="num">Aves vivas</th><th>Ovos</th><th>Descarte</th><th>Mortes</th><th>Ração (kg)</th></tr></thead>
                <tbody>
                  {ativos.map((l) => {
                    const ln = linhas[l.id] ?? linhaVazia;
                    const corte = l.finalidade === 'corte';
                    return (
                      <tr key={l.id}>
                        <td><strong>{l.codigo}</strong> <span className="muted small">{l.galpao}</span></td>
                        <td className="num">{indicesLote(l, registrosAves).avesVivas}</td>
                        <td><input type="number" min={0} disabled={corte} value={ln.ovos} onChange={(e) => set(l.id, 'ovos', e.target.value)} style={{ maxWidth: 110 }} /></td>
                        <td><input type="number" min={0} disabled={corte} value={ln.ovosDescarte} onChange={(e) => set(l.id, 'ovosDescarte', e.target.value)} style={{ maxWidth: 100 }} /></td>
                        <td><input type="number" min={0} value={ln.mortes} onChange={(e) => set(l.id, 'mortes', e.target.value)} style={{ maxWidth: 90 }} /></td>
                        <td><input type="number" min={0} step="0.1" value={ln.racaoKg} onChange={(e) => set(l.id, 'racaoKg', e.target.value)} style={{ maxWidth: 110 }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              {salvo && <span className="muted small">Registros salvos ✓</span>}
              <button className="btn primary" onClick={salvar}>Salvar dia {formatarData(data)}</button>
            </div>
          </>
        )}
      </Card>

      <Card titulo="Dúzias aproveitáveis por dia" subtitulo="Todos os lotes, últimos 30 dias">
        {grafico.length ? <GraficoBarras dados={grafico} x="dia" series={[{ chave: 'duzias', rotulo: 'Dúzias', slot: 1 }]} formatar={formatarNumero} /> : <Vazio titulo="Sem registros" />}
      </Card>

      <Card titulo="Resumo diário" flush>
        <div className="table-wrap">
          <table className="tabela">
            <thead><tr><th>Data</th><th className="num">Ovos</th><th className="num">Descarte</th><th className="num">Dúzias úteis</th><th className="num">Mortes</th><th className="num">Ração</th></tr></thead>
            <tbody>
              {resumo.map(([d, m]) => (
                <tr key={d}>
                  <td>{formatarData(d)}</td>
                  <td className="num">{m.ovos}</td>
                  <td className="num">{m.descarte}</td>
                  <td className="num">{formatarNumero((m.ovos - m.descarte) / 12)}</td>
                  <td className="num">{m.mortes}</td>
                  <td className="num">{formatarNumero(m.racao)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

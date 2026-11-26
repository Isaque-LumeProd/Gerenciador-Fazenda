import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, Card, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoBarras, GraficoLinha } from '@/components/Graficos';
import { useBovinosDerivados } from '@/lib/hooks';
import { gerarAlertas } from '@/lib/alertas';
import { arrobas, indicesLote, unidadesAnimais, lotacao } from '@/lib/zootecnia';
import { formatarData, hoje, mesAno, rotuloMes, somarDias, ultimosMeses } from '@/lib/datas';
import { formatarMoeda, formatarNumero, formatarPct } from '@/lib/formato';

export default function Painel() {
  const s = useFazenda();
  const bovinos = useBovinosDerivados();
  const H = hoje();

  const ativos = bovinos.filter((b) => b.status === 'ativo');
  const pesoTotal = ativos.reduce((t, b) => t + (b.peso ?? 0), 0);
  const ua = unidadesAnimais(pesoTotal);
  const areaPastos = s.pastos.filter((p) => p.status === 'em uso').reduce((t, p) => t + p.areaHa, 0);
  const valorRebanho = arrobas(pesoTotal) * s.config.precoArroba;
  const prenhes = ativos.filter((b) => b.reproducao?.status === 'prenhe').length;

  const lotesAtivos = s.lotesAves.filter((l) => l.status === 'ativo');
  const indices = lotesAtivos.map((l) => indicesLote(l, s.registrosAves));
  const avesVivas = indices.reduce((t, i) => t + i.avesVivas, 0);

  const ovosPorDia = useMemo(() => {
    const ids = new Set(s.lotesAves.map((l) => l.id));
    const mapa = new Map<string, number>();
    for (const r of s.registrosAves) if (ids.has(r.loteId)) mapa.set(r.data, (mapa.get(r.data) ?? 0) + r.ovos);
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = somarDias(H, -i);
      out.push({ dia: formatarData(d).slice(0, 5), ovos: mapa.get(d) ?? null });
    }
    return out;
  }, [s.registrosAves, s.lotesAves, H]);
  const ultimos7 = ovosPorDia.slice(-8, -1).map((d) => d.ovos ?? 0);
  const mediaOvos = ultimos7.reduce((a, b) => a + b, 0) / (ultimos7.length || 1);

  const financeiro = useMemo(() => {
    const meses = ultimosMeses(12);
    return meses.map((m) => {
      const doMes = s.lancamentos.filter((l) => mesAno(l.data) === m);
      return {
        mes: rotuloMes(m),
        receitas: doMes.filter((l) => l.tipo === 'receita').reduce((t, l) => t + l.valor, 0),
        despesas: doMes.filter((l) => l.tipo === 'despesa').reduce((t, l) => t + l.valor, 0),
      };
    });
  }, [s.lancamentos]);
  const mesAtual = financeiro[financeiro.length - 1];
  const saldo12 = financeiro.reduce((t, m) => t + m.receitas - m.despesas, 0);

  const categorias = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of ativos) c.set(b.categoria, (c.get(b.categoria) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [ativos]);

  const alertas = useMemo(() => gerarAlertas(s), [s]);
  const proximas = s.tarefas
    .filter((t) => !t.concluida)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 6);

  return (
    <div className="stack">
      <PageHeader titulo={s.config.nomeEstancia} subtitulo={`Resumo da estância em ${formatarData(H)}`} />

      <div className="grid stats tres">
        <Stat rotulo="Bovinos ativos" valor={ativos.length} sub={`${formatarNumero(ua)} UA · ${prenhes} vacas prenhes`} />
        <Stat
          rotulo="Lotação"
          valor={`${formatarNumero(lotacao(ua, areaPastos))} UA/ha`}
          sub={`${formatarNumero(areaPastos)} ha de pasto em uso`}
        />
        <Stat rotulo="Valor estimado do rebanho" valor={formatarMoeda(valorRebanho)} sub={`${formatarNumero(arrobas(pesoTotal))} @ a ${formatarMoeda(s.config.precoArroba)}`} />
        <Stat rotulo="Aves alojadas" valor={formatarNumero(avesVivas)} sub={`${lotesAtivos.length} lote(s) ativo(s)`} />
        <Stat rotulo="Ovos / dia (média 7d)" valor={formatarNumero(mediaOvos)} sub={`${formatarNumero(mediaOvos / 12)} dúzias por dia`} />
        <Stat
          rotulo={`Resultado de ${mesAtual.mes}`}
          valor={formatarMoeda(mesAtual.receitas - mesAtual.despesas)}
          tom={mesAtual.receitas - mesAtual.despesas >= 0 ? 'positivo' : 'negativo'}
          sub={`12 meses: ${formatarMoeda(saldo12)}`}
        />
      </div>

      <div className="grid cols-2-1">
        <Card titulo="Receitas x despesas" subtitulo="Últimos 12 meses">
          <GraficoBarras
            dados={financeiro}
            x="mes"
            series={[
              { chave: 'receitas', rotulo: 'Receitas', slot: 1 },
              { chave: 'despesas', rotulo: 'Despesas', slot: 2 },
            ]}
            formatar={(v) => (Math.abs(v) >= 1000 ? `R$ ${formatarNumero(v / 1000)}k` : formatarMoeda(v))}
          />
        </Card>
        <Card titulo="Alertas" subtitulo={`${alertas.length} item(ns) exigem atenção`}>
          {alertas.length === 0 ? (
            <Vazio titulo="Tudo em dia">Nenhuma pendência no momento.</Vazio>
          ) : (
            <div className="alertas" style={{ maxHeight: 290, overflowY: 'auto' }}>
              {alertas.map((a) => (
                <Link key={a.id} to={a.link} className="alerta">
                  <span className={`ponto ${a.nivel}`} title={a.nivel} />
                  <span>
                    {a.titulo}
                    <small>{a.detalhe}</small>
                  </span>
                  <span className="area"><Badge tom={a.nivel === 'crítico' ? 'vermelho' : a.nivel === 'atenção' ? 'amarelo' : 'azul'}>{a.area}</Badge></span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid cols-3">
        <Card titulo="Produção de ovos" subtitulo="Ovos coletados por dia, últimos 30 dias">
          <GraficoLinha dados={ovosPorDia} x="dia" series={[{ chave: 'ovos', rotulo: 'Ovos', slot: 1 }]} formatar={formatarNumero} altura={220} />
        </Card>
        <Card titulo="Composição do rebanho" subtitulo="Animais ativos por categoria">
          {categorias.length === 0 ? (
            <Vazio titulo="Sem animais cadastrados" />
          ) : (
            <table className="tabela">
              <tbody>
                {categorias.map(([cat, n]) => (
                  <tr key={cat}>
                    <td style={{ textTransform: 'capitalize' }}>{cat}</td>
                    <td style={{ width: '50%' }}>
                      <div className="barra"><div style={{ width: `${(n / ativos.length) * 100}%` }} /></div>
                    </td>
                    <td className="num">{n}</td>
                    <td className="num muted">{formatarPct(n / ativos.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card titulo="Próximas tarefas" acoes={<Link to="/agenda" className="small">Ver agenda</Link>}>
          {proximas.length === 0 ? (
            <Vazio titulo="Nenhuma tarefa pendente" />
          ) : (
            <ul className="lista-tarefas">
              {proximas.map((t) => (
                <li key={t.id}>
                  <span className="titulo">{t.titulo}</span>
                  <Badge tom={t.data < H ? 'vermelho' : t.data === H ? 'amarelo' : 'neutro'}>{formatarData(t.data).slice(0, 5)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {lotesAtivos.length > 0 && (
        <Card titulo="Lotes de aves" flush acoes={<Link to="/aves" className="small">Ver lotes</Link>}>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Lote</th><th>Finalidade</th><th>Galpão</th><th className="num">Idade</th>
                  <th className="num">Aves vivas</th><th className="num">Mortalidade</th><th className="num">Postura (7d)</th>
                </tr>
              </thead>
              <tbody>
                {lotesAtivos.map((l, i) => (
                  <tr key={l.id}>
                    <td><Link to={`/aves/${l.id}`}>{l.codigo}</Link></td>
                    <td style={{ textTransform: 'capitalize' }}>{l.finalidade}</td>
                    <td>{l.galpao}</td>
                    <td className="num">{Math.floor(indices[i].idadeDias / 7)} sem</td>
                    <td className="num">{indices[i].avesVivas}</td>
                    <td className="num">{formatarPct(indices[i].mortalidade)}</td>
                    <td className="num">{l.finalidade === 'postura' ? formatarPct(indices[i].posturaRecente) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

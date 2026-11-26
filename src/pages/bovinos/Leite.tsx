import { useMemo } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { GraficoLinha } from '@/components/Graficos';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { diffDias, formatarData, hoje, mesAno } from '@/lib/datas';
import { formatarNumero } from '@/lib/formato';
import type { ProducaoLeite } from '@/types';

const vazio = (): Omit<ProducaoLeite, 'id'> => ({ data: hoje(), litros: 0, vacasOrdenhadas: 1 });

export default function Leite() {
  const { leite, adicionar, atualizar, remover } = useFazenda();
  const f = useFormulario(vazio);
  const H = hoje();

  const ordenado = useMemo(() => [...leite].sort((a, b) => b.data.localeCompare(a.data)), [leite]);
  const ult7 = leite.filter((l) => diffDias(l.data, H) <= 7 && diffDias(l.data, H) >= 0);
  const media7 = ult7.reduce((t, l) => t + l.litros, 0) / (ult7.length || 1);
  const porVaca = ult7.reduce((t, l) => t + l.litros / (l.vacasOrdenhadas || 1), 0) / (ult7.length || 1);
  const totalMes = leite.filter((l) => mesAno(l.data) === mesAno(H)).reduce((t, l) => t + l.litros, 0);
  const grafico = [...leite]
    .filter((l) => diffDias(l.data, H) <= 60)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => ({ dia: formatarData(l.data).slice(0, 5), litros: l.litros }));

  const salvar = () => {
    if (!(f.valores.litros > 0)) return alert('Informe os litros produzidos.');
    if (f.editandoId) atualizar('leite', f.editandoId, f.valores);
    else adicionar('leite', f.valores);
    f.fechar();
  };

  return (
    <div className="stack">
      <PageHeader titulo="Produção de leite" subtitulo="Registro diário da ordenha">
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Registrar ordenha</button>
      </PageHeader>
      <div className="grid stats">
        <Stat rotulo="Média diária (7d)" valor={`${formatarNumero(media7)} L`} />
        <Stat rotulo="Litros por vaca/dia" valor={`${formatarNumero(porVaca)} L`} />
        <Stat rotulo="Total no mês" valor={`${formatarNumero(totalMes)} L`} />
      </div>
      <Card titulo="Litros por dia" subtitulo="Últimos 60 dias">
        {grafico.length ? <GraficoLinha dados={grafico} x="dia" series={[{ chave: 'litros', rotulo: 'Litros', slot: 1 }]} formatar={formatarNumero} /> : <Vazio titulo="Sem registros" />}
      </Card>
      <Card flush titulo="Registros">
        <div className="table-wrap">
          <table className="tabela">
            <thead><tr><th>Data</th><th className="num">Litros</th><th className="num">Vacas</th><th className="num">L/vaca</th><th>Obs.</th><th /></tr></thead>
            <tbody>
              {ordenado.map((l) => (
                <tr key={l.id}>
                  <td>{formatarData(l.data)}</td>
                  <td className="num">{formatarNumero(l.litros)}</td>
                  <td className="num">{l.vacasOrdenhadas}</td>
                  <td className="num">{formatarNumero(l.litros / (l.vacasOrdenhadas || 1))}</td>
                  <td className="muted">{l.observacoes}</td>
                  <td className="acoes"><BotoesLinha onEditar={() => f.abrir(l)} onExcluir={() => remover('leite', l.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar ordenha' : 'Registrar ordenha'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Data"><input type="date" {...f.campo('data')} required /></Campo>
        <Campo rotulo="Litros"><input type="number" min={0} step="0.1" {...f.campo('litros')} required /></Campo>
        <Campo rotulo="Vacas ordenhadas"><input type="number" min={1} {...f.campo('vacasOrdenhadas')} /></Campo>
        <Campo rotulo="Observações"><input {...f.campo('observacoes')} /></Campo>
      </ModalForm>
    </div>
  );
}

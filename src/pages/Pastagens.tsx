import { useMemo } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Badge, Barra, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { useBovinosDerivados } from '@/lib/hooks';
import { formatarNumero } from '@/lib/formato';
import { lotacao, unidadesAnimais } from '@/lib/zootecnia';
import type { Pasto } from '@/types';

const vazio = (): Omit<Pasto, 'id'> => ({ nome: '', areaHa: 0, forrageira: '', status: 'em uso' });
const tomStatus = { 'em uso': 'verde', descanso: 'amarelo', reforma: 'marrom' } as const;
/** Lotação de referência para pastagem cultivada (UA/ha). */
const LOTACAO_REFERENCIA = 2;

export default function Pastagens() {
  const { pastos, adicionar, atualizar, remover } = useFazenda();
  const bovinos = useBovinosDerivados();
  const f = useFormulario(vazio);

  const linhas = useMemo(
    () =>
      pastos.map((p) => {
        const animais = bovinos.filter((b) => b.status === 'ativo' && b.pastoId === p.id);
        const peso = animais.reduce((t, b) => t + (b.peso ?? 0), 0);
        const ua = unidadesAnimais(peso);
        return { ...p, cabecas: animais.length, ua, lot: lotacao(ua, p.areaHa) };
      }),
    [pastos, bovinos],
  );
  const semPasto = bovinos.filter((b) => b.status === 'ativo' && !b.pastoId).length;
  const area = pastos.reduce((t, p) => t + p.areaHa, 0);

  const salvar = () => {
    if (!f.valores.nome.trim()) return alert('Informe o nome do pasto.');
    const { nome, areaHa, forrageira, status, observacoes } = f.valores;
    const dados = { nome, areaHa, forrageira, status, observacoes };
    if (f.editandoId) atualizar('pastos', f.editandoId, dados);
    else adicionar('pastos', dados);
    f.fechar();
  };

  return (
    <div className="stack">
      <PageHeader titulo="Pastagens" subtitulo="Piquetes, potreiros e invernadas — área, lotação e rodízio">
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Novo pasto</button>
      </PageHeader>
      <div className="grid stats">
        <Stat rotulo="Área de pastagem" valor={`${formatarNumero(area)} ha`} sub={`${pastos.length} pasto(s)`} />
        <Stat rotulo="Em uso" valor={pastos.filter((p) => p.status === 'em uso').length} />
        <Stat rotulo="Em descanso" valor={pastos.filter((p) => p.status === 'descanso').length} />
        <Stat rotulo="Animais sem pasto" valor={semPasto} tom={semPasto ? 'negativo' : undefined} />
      </div>
      <Card flush>
        {linhas.length === 0 ? <Vazio titulo="Nenhum pasto cadastrado" /> : (
          <div className="table-wrap">
            <table className="tabela">
              <thead><tr><th>Pasto</th><th>Forrageira</th><th className="num">Área</th><th className="num">Cabeças</th><th className="num">UA</th><th className="num">Lotação</th><th style={{ minWidth: 140 }}>Ocupação</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {linhas.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nome}</strong>{p.observacoes && <div className="muted small">{p.observacoes}</div>}</td>
                    <td>{p.forrageira || '—'}</td>
                    <td className="num">{formatarNumero(p.areaHa)} ha</td>
                    <td className="num">{p.cabecas}</td>
                    <td className="num">{formatarNumero(p.ua)}</td>
                    <td className="num">{formatarNumero(p.lot)} UA/ha</td>
                    <td><Barra valor={p.lot} max={LOTACAO_REFERENCIA} nivel={p.lot > LOTACAO_REFERENCIA ? 'critico' : p.lot > LOTACAO_REFERENCIA * 0.8 ? 'alerta' : undefined} /></td>
                    <td><Badge tom={tomStatus[p.status]}>{p.status}</Badge>{p.status !== 'em uso' && p.cabecas > 0 && <> <Badge tom="vermelho">com animais</Badge></>}</td>
                    <td className="acoes"><BotoesLinha onEditar={() => f.abrir(p)} onExcluir={() => remover('pastos', p.id)} confirmacao="Excluir este pasto? Os animais ficarão sem pasto definido." /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ padding: '8px 18px 14px', margin: 0 }}>
          UA = 450 kg de peso vivo. A barra de ocupação usa {LOTACAO_REFERENCIA} UA/ha como referência; ajuste conforme a forrageira e a estação.
          Para mover animais entre pastos, edite o animal no Rebanho.
        </p>
      </Card>
      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar pasto' : 'Novo pasto'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Nome *"><input {...f.campo('nome')} required autoFocus /></Campo>
        <Campo rotulo="Área (ha)"><input type="number" min={0} step="0.1" {...f.campo('areaHa')} /></Campo>
        <Campo rotulo="Forrageira"><input {...f.campo('forrageira')} placeholder="ex.: Tifton, campo nativo, azevém" /></Campo>
        <Campo rotulo="Situação">
          <select {...f.campo('status')}><option value="em uso">Em uso</option><option value="descanso">Descanso</option><option value="reforma">Reforma</option></select>
        </Campo>
        <Campo rotulo="Observações" full><textarea rows={2} {...f.campo('observacoes')} /></Campo>
      </ModalForm>
    </div>
  );
}

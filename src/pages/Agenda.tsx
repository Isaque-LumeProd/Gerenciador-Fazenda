import { useMemo, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Campo, Card, ModalForm, PageHeader, Vazio, type Tom } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { diffDias, formatarData, hoje } from '@/lib/datas';
import type { Tarefa } from '@/types';

const vazio = (): Omit<Tarefa, 'id'> => ({ titulo: '', data: hoje(), prioridade: 'média', area: 'geral', concluida: false });
const tomPrioridade: Record<Tarefa['prioridade'], Tom> = { alta: 'vermelho', média: 'amarelo', baixa: 'neutro' };
const AREAS: Tarefa['area'][] = ['bovinos', 'aves', 'pastagens', 'manutenção', 'geral'];

export default function Agenda() {
  const { tarefas, funcionarios, adicionar, atualizar, remover } = useFazenda();
  const f = useFormulario(vazio);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [area, setArea] = useState('');
  const H = hoje();

  const grupos = useMemo(() => {
    const lista = tarefas
      .filter((t) => (mostrarConcluidas || !t.concluida) && (!area || t.area === area))
      .sort((a, b) => Number(a.concluida) - Number(b.concluida) || a.data.localeCompare(b.data));
    const g: { titulo: string; itens: Tarefa[] }[] = [
      { titulo: 'Atrasadas', itens: [] },
      { titulo: 'Hoje', itens: [] },
      { titulo: 'Próximos 7 dias', itens: [] },
      { titulo: 'Mais tarde', itens: [] },
      { titulo: 'Concluídas', itens: [] },
    ];
    for (const t of lista) {
      const d = diffDias(H, t.data);
      if (t.concluida) g[4].itens.push(t);
      else if (d < 0) g[0].itens.push(t);
      else if (d === 0) g[1].itens.push(t);
      else if (d <= 7) g[2].itens.push(t);
      else g[3].itens.push(t);
    }
    return g.filter((x) => x.itens.length);
  }, [tarefas, mostrarConcluidas, area, H]);

  const salvar = () => {
    if (!f.valores.titulo.trim()) return alert('Informe o título da tarefa.');
    const { titulo, descricao, data, prioridade, area: a, responsavel, concluida } = f.valores;
    const dados = { titulo, descricao, data, prioridade, area: a, responsavel, concluida };
    if (f.editandoId) atualizar('tarefas', f.editandoId, dados);
    else adicionar('tarefas', dados);
    f.fechar();
  };

  return (
    <div className="stack">
      <PageHeader titulo="Agenda" subtitulo="Tarefas e atividades da estância">
        <button className="btn primary" onClick={() => f.abrir()}><Icone nome="mais" tamanho={16} />Nova tarefa</button>
      </PageHeader>
      <div className="filtros">
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas as áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={mostrarConcluidas} onChange={(e) => setMostrarConcluidas(e.target.checked)} />Mostrar concluídas</label>
      </div>
      {grupos.length === 0 ? <Card><Vazio titulo="Nenhuma tarefa">Cadastre a próxima atividade da estância.</Vazio></Card> : grupos.map((g) => (
        <Card key={g.titulo} titulo={`${g.titulo} (${g.itens.length})`}>
          <ul className="lista-tarefas">
            {g.itens.map((t) => (
              <li key={t.id} className={t.concluida ? 'feita' : ''}>
                <input type="checkbox" checked={t.concluida} onChange={(e) => atualizar('tarefas', t.id, { concluida: e.target.checked })} aria-label="Concluir" />
                <span className="titulo">
                  {t.titulo}
                  {(t.descricao || t.responsavel) && <div className="muted small">{[t.responsavel, t.descricao].filter(Boolean).join(' · ')}</div>}
                </span>
                <Badge>{t.area}</Badge>
                <Badge tom={tomPrioridade[t.prioridade]}>{t.prioridade}</Badge>
                <span className="small muted" style={{ minWidth: 80, textAlign: 'right' }}>{formatarData(t.data)}</span>
                <BotoesLinha onEditar={() => f.abrir(t)} onExcluir={() => remover('tarefas', t.id)} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar tarefa' : 'Nova tarefa'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Título *" full><input {...f.campo('titulo')} required autoFocus /></Campo>
        <Campo rotulo="Data"><input type="date" {...f.campo('data')} /></Campo>
        <Campo rotulo="Prioridade"><select {...f.campo('prioridade')}><option value="alta">Alta</option><option value="média">Média</option><option value="baixa">Baixa</option></select></Campo>
        <Campo rotulo="Área"><select {...f.campo('area')}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Campo>
        <Campo rotulo="Responsável">
          <input list="func" {...f.campo('responsavel')} />
          <datalist id="func">{funcionarios.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.nome.split(' ')[0]} />)}</datalist>
        </Campo>
        <Campo rotulo="Descrição" full><textarea rows={2} {...f.campo('descricao')} /></Campo>
      </ModalForm>
    </div>
  );
}

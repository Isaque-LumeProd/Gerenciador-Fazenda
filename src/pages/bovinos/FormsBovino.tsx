import { useEffect, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Campo, ModalForm } from '@/components/ui';
import type { Bovino } from '@/types';
import { hoje } from '@/lib/datas';

export const RACAS_BOVINAS = ['Angus', 'Hereford', 'Braford', 'Brangus', 'Nelore', 'Charolês', 'Devon', 'Holandesa', 'Jersey', 'Girolando', 'Cruzado'];

const vazio = (): Omit<Bovino, 'id'> => ({
  brinco: '',
  nome: '',
  raca: 'Angus',
  sexo: 'F',
  dataNascimento: hoje(),
  finalidade: 'corte',
  origem: 'nascido',
  status: 'ativo',
});

/** Modal de cadastro/edição de bovino. Opcionalmente registra a pesagem inicial. */
export function ModalBovino({ aberto, inicial, onFechar, onSalvo }: {
  aberto: boolean;
  inicial?: Partial<Bovino>;
  onFechar: () => void;
  onSalvo?: (id: string) => void;
}) {
  const { bovinos, pastos, adicionar, atualizar } = useFazenda();
  const [v, setV] = useState(vazio());
  const [pesoInicial, setPesoInicial] = useState('');

  useEffect(() => {
    if (aberto) {
      setV({ ...vazio(), ...inicial });
      setPesoInicial('');
    }
  }, [aberto, inicial]);

  const set = <K extends keyof typeof v>(k: K, valor: (typeof v)[K]) => setV((x) => ({ ...x, [k]: valor }));
  const editando = inicial?.id;
  const maes = bovinos.filter((b) => b.sexo === 'F' && b.id !== editando);

  const salvar = () => {
    if (!v.brinco.trim()) return alert('Informe o número do brinco.');
    const duplicado = bovinos.find((b) => b.brinco === v.brinco.trim() && b.id !== editando && b.status === 'ativo');
    if (duplicado) return alert(`Já existe um animal ativo com o brinco ${v.brinco}.`);
    // Copia apenas os campos persistidos (o `inicial` pode trazer campos derivados).
    const dados: Omit<Bovino, 'id'> = {
      brinco: v.brinco.trim(),
      nome: v.nome?.trim() || undefined,
      raca: v.raca,
      sexo: v.sexo,
      dataNascimento: v.dataNascimento,
      finalidade: v.finalidade,
      origem: v.origem,
      maeId: v.maeId,
      pai: v.pai || undefined,
      pastoId: v.pastoId,
      status: v.status,
      dataSaida: v.dataSaida,
      motivoSaida: v.motivoSaida,
      observacoes: v.observacoes || undefined,
    };
    let id = editando;
    if (editando) atualizar('bovinos', editando, dados);
    else {
      id = adicionar('bovinos', dados);
      const p = Number(pesoInicial);
      if (p > 0) adicionar('pesagens', { bovinoId: id, data: hoje(), pesoKg: p, observacoes: 'Pesagem de cadastro' });
    }
    onSalvo?.(id!);
    onFechar();
  };

  return (
    <ModalForm aberto={aberto} titulo={editando ? 'Editar animal' : 'Novo animal'} onFechar={onFechar} onSalvar={salvar}>
      <Campo rotulo="Brinco / identificação *">
        <input value={v.brinco} onChange={(e) => set('brinco', e.target.value)} autoFocus required />
      </Campo>
      <Campo rotulo="Nome">
        <input value={v.nome ?? ''} onChange={(e) => set('nome', e.target.value)} />
      </Campo>
      <Campo rotulo="Sexo">
        <select value={v.sexo} onChange={(e) => set('sexo', e.target.value as Bovino['sexo'])}>
          <option value="F">Fêmea</option>
          <option value="M">Macho</option>
        </select>
      </Campo>
      <Campo rotulo="Raça">
        <input list="racas-bovinas" value={v.raca} onChange={(e) => set('raca', e.target.value)} />
        <datalist id="racas-bovinas">{RACAS_BOVINAS.map((r) => <option key={r} value={r} />)}</datalist>
      </Campo>
      <Campo rotulo="Data de nascimento">
        <input type="date" value={v.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} required />
      </Campo>
      <Campo rotulo="Finalidade">
        <select value={v.finalidade} onChange={(e) => set('finalidade', e.target.value as Bovino['finalidade'])}>
          <option value="corte">Corte</option>
          <option value="leite">Leite</option>
          <option value="reprodução">Reprodução</option>
        </select>
      </Campo>
      <Campo rotulo="Origem">
        <select value={v.origem} onChange={(e) => set('origem', e.target.value as Bovino['origem'])}>
          <option value="nascido">Nascido na estância</option>
          <option value="comprado">Comprado</option>
        </select>
      </Campo>
      <Campo rotulo="Pasto / piquete">
        <select value={v.pastoId ?? ''} onChange={(e) => set('pastoId', e.target.value || undefined)}>
          <option value="">— sem pasto —</option>
          {pastos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Mãe">
        <select value={v.maeId ?? ''} onChange={(e) => set('maeId', e.target.value || undefined)}>
          <option value="">— desconhecida —</option>
          {maes.map((m) => <option key={m.id} value={m.id}>{m.brinco}{m.nome ? ` · ${m.nome}` : ''}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Pai / touro / sêmen">
        <input value={v.pai ?? ''} onChange={(e) => set('pai', e.target.value)} />
      </Campo>
      {!editando && (
        <Campo rotulo="Peso atual (kg)" dica="Opcional — cria a primeira pesagem">
          <input type="number" min={0} step="0.1" value={pesoInicial} onChange={(e) => setPesoInicial(e.target.value)} />
        </Campo>
      )}
      <Campo rotulo="Observações" full>
        <textarea rows={2} value={v.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} />
      </Campo>
    </ModalForm>
  );
}

/** Registra venda ou morte de um animal; vendas podem gerar receita no financeiro. */
export function ModalSaida({ bovino, onFechar }: { bovino?: Bovino; onFechar: () => void }) {
  const { atualizar, adicionar } = useFazenda();
  const [tipo, setTipo] = useState<'vendido' | 'morto'>('vendido');
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState('');
  const [valor, setValor] = useState('');

  useEffect(() => {
    setTipo('vendido');
    setData(hoje());
    setMotivo('');
    setValor('');
  }, [bovino]);

  if (!bovino) return null;
  const salvar = () => {
    atualizar('bovinos', bovino.id, { status: tipo, dataSaida: data, motivoSaida: motivo || undefined, pastoId: undefined });
    const v = Number(valor);
    if (tipo === 'vendido' && v > 0) {
      adicionar('lancamentos', {
        tipo: 'receita',
        categoria: 'Venda de gado',
        atividade: 'bovinos',
        descricao: `Venda do animal ${bovino.brinco}${motivo ? ' — ' + motivo : ''}`,
        valor: v,
        data,
        pago: true,
      });
    }
    onFechar();
  };

  return (
    <ModalForm aberto titulo={`Registrar saída — brinco ${bovino.brinco}`} onFechar={onFechar} onSalvar={salvar} textoSalvar="Registrar saída">
      <Campo rotulo="Tipo de saída">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'vendido' | 'morto')}>
          <option value="vendido">Venda</option>
          <option value="morto">Morte</option>
        </select>
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Campo rotulo={tipo === 'vendido' ? 'Comprador / observação' : 'Causa da morte'} full>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      {tipo === 'vendido' && (
        <Campo rotulo="Valor da venda (R$)" dica="Se informado, lança uma receita no financeiro" full>
          <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
      )}
    </ModalForm>
  );
}

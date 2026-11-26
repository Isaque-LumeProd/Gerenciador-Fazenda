import { useEffect, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Campo, ModalForm } from '@/components/ui';
import { hoje } from '@/lib/datas';
import { indicesLote } from '@/lib/zootecnia';
import type { LoteAves, RegistroAves } from '@/types';

export const RACAS_AVES = ['Embrapa 051', 'Caipira Pescoço Pelado', 'Label Rouge', 'Isa Brown', 'Hy-Line', 'Plymouth Rock', 'Rhode Island Red', 'Cobb', 'Ross', 'Colonial'];

const vazioLote = (): Omit<LoteAves, 'id'> => ({
  codigo: '',
  finalidade: 'postura',
  raca: 'Embrapa 051',
  galpao: '',
  dataAlojamento: hoje(),
  idadeInicialDias: 1,
  quantidadeInicial: 100,
  status: 'ativo',
});

export function ModalLote({ aberto, inicial, onFechar }: { aberto: boolean; inicial?: Partial<LoteAves>; onFechar: () => void }) {
  const { adicionar, atualizar } = useFazenda();
  const [v, setV] = useState(vazioLote());
  useEffect(() => {
    if (aberto) setV({ ...vazioLote(), ...inicial });
  }, [aberto, inicial]);
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));

  const salvar = () => {
    if (!v.codigo.trim()) return alert('Informe o código do lote.');
    if (!(v.quantidadeInicial > 0)) return alert('Informe a quantidade de aves.');
    const dados: Omit<LoteAves, 'id'> = {
      codigo: v.codigo.trim(),
      finalidade: v.finalidade,
      raca: v.raca,
      galpao: v.galpao,
      dataAlojamento: v.dataAlojamento,
      idadeInicialDias: v.idadeInicialDias,
      quantidadeInicial: v.quantidadeInicial,
      status: v.status,
      dataEncerramento: v.status === 'encerrado' ? v.dataEncerramento ?? hoje() : undefined,
      observacoes: v.observacoes || undefined,
    };
    if (inicial?.id) atualizar('lotesAves', inicial.id, dados);
    else adicionar('lotesAves', dados);
    onFechar();
  };

  return (
    <ModalForm aberto={aberto} titulo={inicial?.id ? 'Editar lote' : 'Novo lote de aves'} onFechar={onFechar} onSalvar={salvar}>
      <Campo rotulo="Código do lote *"><input value={v.codigo} onChange={(e) => set('codigo', e.target.value)} autoFocus required /></Campo>
      <Campo rotulo="Finalidade">
        <select value={v.finalidade} onChange={(e) => set('finalidade', e.target.value as LoteAves['finalidade'])}>
          <option value="postura">Postura (ovos)</option>
          <option value="corte">Corte (frango)</option>
          <option value="matrizes">Matrizes (reprodução)</option>
        </select>
      </Campo>
      <Campo rotulo="Raça / linhagem">
        <input list="racas-aves" value={v.raca} onChange={(e) => set('raca', e.target.value)} />
        <datalist id="racas-aves">{RACAS_AVES.map((r) => <option key={r} value={r} />)}</datalist>
      </Campo>
      <Campo rotulo="Galpão / aviário"><input value={v.galpao} onChange={(e) => set('galpao', e.target.value)} /></Campo>
      <Campo rotulo="Data de alojamento"><input type="date" value={v.dataAlojamento} onChange={(e) => set('dataAlojamento', e.target.value)} /></Campo>
      <Campo rotulo="Idade no alojamento (dias)"><input type="number" min={0} value={v.idadeInicialDias} onChange={(e) => set('idadeInicialDias', Number(e.target.value))} /></Campo>
      <Campo rotulo="Quantidade de aves"><input type="number" min={1} value={v.quantidadeInicial} onChange={(e) => set('quantidadeInicial', Number(e.target.value))} /></Campo>
      <Campo rotulo="Situação">
        <select value={v.status} onChange={(e) => set('status', e.target.value as LoteAves['status'])}>
          <option value="ativo">Ativo</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </Campo>
      {v.status === 'encerrado' && (
        <Campo rotulo="Data de encerramento"><input type="date" value={v.dataEncerramento ?? hoje()} onChange={(e) => set('dataEncerramento', e.target.value)} /></Campo>
      )}
      <Campo rotulo="Observações" full><textarea rows={2} value={v.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
    </ModalForm>
  );
}

const vazioReg = (): Omit<RegistroAves, 'id'> => ({ loteId: '', data: hoje(), ovos: 0, ovosDescarte: 0, mortes: 0, racaoKg: 0 });

export function ModalRegistro({ aberto, inicial, onFechar }: { aberto: boolean; inicial?: Partial<RegistroAves>; onFechar: () => void }) {
  const { lotesAves, registrosAves, adicionar, atualizar } = useFazenda();
  const [v, setV] = useState(vazioReg());
  useEffect(() => {
    if (aberto) setV({ ...vazioReg(), ...inicial });
  }, [aberto, inicial]);
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));
  const lote = lotesAves.find((l) => l.id === v.loteId);
  const editando = inicial?.id;

  const salvar = () => {
    if (!v.loteId) return alert('Selecione o lote.');
    if (lote && v.ovos > indicesLote(lote, registrosAves).avesVivas && !confirm('Há mais ovos do que aves vivas no lote. Salvar mesmo assim?')) return;
    const existente = registrosAves.find((r) => r.loteId === v.loteId && r.data === v.data && r.id !== editando);
    if (existente && !confirm('Já existe um registro deste lote nesta data. Deseja criar outro mesmo assim?')) return;
    const dados: Omit<RegistroAves, 'id'> = {
      loteId: v.loteId, data: v.data, ovos: v.ovos || 0, ovosDescarte: v.ovosDescarte || 0, mortes: v.mortes || 0,
      racaoKg: v.racaoKg || 0, pesoMedioG: v.pesoMedioG || undefined, observacoes: v.observacoes || undefined,
    };
    if (editando) atualizar('registrosAves', editando, dados);
    else adicionar('registrosAves', dados);
    onFechar();
  };

  const num = (k: 'ovos' | 'ovosDescarte' | 'mortes' | 'racaoKg' | 'pesoMedioG') => ({
    type: 'number', min: 0, step: k === 'racaoKg' ? '0.1' : '1',
    value: v[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value === '' ? (k === 'pesoMedioG' ? undefined : 0) : Number(e.target.value)),
  });

  return (
    <ModalForm aberto={aberto} titulo={editando ? 'Editar registro diário' : 'Registro diário do lote'} onFechar={onFechar} onSalvar={salvar}>
      <Campo rotulo="Lote">
        <select value={v.loteId} onChange={(e) => set('loteId', e.target.value)} required>
          <option value="">Selecione…</option>
          {lotesAves.filter((l) => l.status === 'ativo' || l.id === v.loteId).map((l) => <option key={l.id} value={l.id}>{l.codigo} — {l.galpao}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data"><input type="date" value={v.data} onChange={(e) => set('data', e.target.value)} required /></Campo>
      {lote?.finalidade !== 'corte' && (
        <>
          <Campo rotulo="Ovos coletados"><input {...num('ovos')} /></Campo>
          <Campo rotulo="Ovos descartados" dica="Trincados, sujos, deformados"><input {...num('ovosDescarte')} /></Campo>
        </>
      )}
      <Campo rotulo="Mortes"><input {...num('mortes')} /></Campo>
      <Campo rotulo="Ração consumida (kg)"><input {...num('racaoKg')} /></Campo>
      {lote?.finalidade === 'corte' && <Campo rotulo="Peso médio (g)" dica="Amostragem semanal"><input {...num('pesoMedioG')} /></Campo>}
      <Campo rotulo="Observações" full><input value={v.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
    </ModalForm>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Card, PageHeader, Stat, Vazio, type Tom } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useBovinosDerivados, type BovinoDerivado } from '@/lib/hooks';
import { formatarIdade } from '@/lib/datas';
import { celulaCsv, formatarNumero, formatarNumero2 } from '@/lib/formato';
import { arrobas } from '@/lib/zootecnia';
import { ModalBovino, ModalSaida } from './FormsBovino';
import type { Bovino } from '@/types';

export const tomStatus: Record<Bovino['status'], Tom> = { ativo: 'verde', vendido: 'azul', morto: 'vermelho' };

export default function Rebanho() {
  const { pastos, remover } = useFazenda();
  const bovinos = useBovinosDerivados();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativo' | 'todos' | 'vendido' | 'morto'>('ativo');
  const [sexo, setSexo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pasto, setPasto] = useState('');
  const [modal, setModal] = useState<{ aberto: boolean; inicial?: Partial<Bovino> }>({ aberto: false });
  const [saida, setSaida] = useState<Bovino>();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return bovinos
      .filter((b) => status === 'todos' || b.status === status)
      .filter((b) => !sexo || b.sexo === sexo)
      .filter((b) => !categoria || b.categoria === categoria)
      .filter((b) => !pasto || b.pastoId === pasto)
      .filter((b) => !q || [b.brinco, b.nome, b.raca].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true }));
  }, [bovinos, busca, status, sexo, categoria, pasto]);

  const ativos = bovinos.filter((b) => b.status === 'ativo');
  const comPeso = ativos.filter((b) => b.peso);
  const pesoMedio = comPeso.reduce((t, b) => t + b.peso!, 0) / (comPeso.length || 1);
  const comGmd = ativos.filter((b) => b.gmd !== undefined);
  const gmdMedio = comGmd.reduce((t, b) => t + b.gmd!, 0) / (comGmd.length || 1);

  const exportarCSV = () => {
    const cab = ['brinco', 'nome', 'raca', 'sexo', 'nascimento', 'categoria', 'peso_kg', 'gmd', 'pasto', 'status'];
    const linhas = filtrados.map((b) => [b.brinco, b.nome ?? '', b.raca, b.sexo, b.dataNascimento, b.categoria, b.peso ?? '', b.gmd?.toFixed(3) ?? '', b.pastoNome ?? '', b.status]);
    const csv = [cab, ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rebanho.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <PageHeader titulo="Rebanho bovino" subtitulo="Cadastro individual dos animais por brinco">
        <button className="btn" onClick={exportarCSV}><Icone nome="download" tamanho={16} />CSV</button>
        <button className="btn primary" onClick={() => setModal({ aberto: true })}><Icone nome="mais" tamanho={16} />Novo animal</button>
      </PageHeader>

      <div className="grid stats">
        <Stat rotulo="Animais ativos" valor={ativos.length} sub={`${ativos.filter((b) => b.sexo === 'F').length} fêmeas · ${ativos.filter((b) => b.sexo === 'M').length} machos`} />
        <Stat rotulo="Peso médio" valor={`${formatarNumero(pesoMedio)} kg`} sub={`${formatarNumero(arrobas(pesoMedio))} @ por cabeça`} />
        <Stat rotulo="GMD médio" valor={`${formatarNumero2(gmdMedio)} kg/dia`} sub="Entre as duas últimas pesagens" />
        <Stat rotulo="Vacas prenhes" valor={ativos.filter((b) => b.reproducao?.status === 'prenhe').length} sub={`de ${ativos.filter((b) => b.categoria === 'vaca' || b.categoria === 'novilha').length} vacas e novilhas`} />
      </div>

      <Card flush>
        <div style={{ padding: '16px 18px 0' }}>
          <div className="filtros">
            <div className="busca"><input placeholder="Buscar por brinco, nome ou raça…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="ativo">Ativos</option>
              <option value="vendido">Vendidos</option>
              <option value="morto">Mortos</option>
              <option value="todos">Todos</option>
            </select>
            <select value={sexo} onChange={(e) => setSexo(e.target.value)}>
              <option value="">Sexo</option>
              <option value="F">Fêmeas</option>
              <option value="M">Machos</option>
            </select>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Categoria</option>
              {['bezerro', 'bezerra', 'garrote', 'novilha', 'vaca', 'boi', 'touro'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={pasto} onChange={(e) => setPasto(e.target.value)}>
              <option value="">Pasto</option>
              {pastos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
        {filtrados.length === 0 ? (
          <Vazio titulo="Nenhum animal encontrado">Ajuste os filtros ou cadastre um novo animal.</Vazio>
        ) : (
          <div className="table-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Brinco</th><th>Raça</th><th>Sexo</th><th>Categoria</th><th className="num">Idade</th>
                  <th className="num">Peso</th><th className="num">GMD</th><th>Pasto</th><th>Situação</th><th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((b) => (
                  <Linha key={b.id} b={b} onEditar={() => setModal({ aberto: true, inicial: b })} onSaida={() => setSaida(b)} onExcluir={() => remover('bovinos', b.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted small" style={{ padding: '10px 18px' }}>{filtrados.length} animal(is)</div>
      </Card>

      <ModalBovino aberto={modal.aberto} inicial={modal.inicial} onFechar={() => setModal({ aberto: false })} />
      <ModalSaida bovino={saida} onFechar={() => setSaida(undefined)} />
    </div>
  );
}

function Linha({ b, onEditar, onSaida, onExcluir }: { b: BovinoDerivado; onEditar: () => void; onSaida: () => void; onExcluir: () => void }) {
  const repro = b.reproducao;
  return (
    <tr className={b.status !== 'ativo' ? 'inativo' : ''}>
      <td><Link to={`/bovinos/${b.id}`}><strong>{b.brinco}</strong>{b.nome ? ` · ${b.nome}` : ''}</Link></td>
      <td>{b.raca}</td>
      <td>{b.sexo === 'F' ? 'Fêmea' : 'Macho'}</td>
      <td style={{ textTransform: 'capitalize' }}>{b.categoria}</td>
      <td className="num">{formatarIdade(b.idadeMeses)}</td>
      <td className="num">{b.peso ? `${formatarNumero(b.peso)} kg` : '—'}</td>
      <td className="num">{b.gmd !== undefined ? formatarNumero2(b.gmd) : '—'}</td>
      <td>{b.pastoNome ?? '—'}</td>
      <td>
        {b.status !== 'ativo' ? (
          <Badge tom={tomStatus[b.status]}>{b.status}</Badge>
        ) : repro && repro.status !== 'vazia' ? (
          <Badge tom={repro.status === 'prenhe' ? 'verde' : repro.status === 'coberta' ? 'amarelo' : 'marrom'}>{repro.status}</Badge>
        ) : (
          <Badge tom="verde">ativo</Badge>
        )}
      </td>
      <td className="acoes">
        {b.status === 'ativo' && <button className="btn small ghost" onClick={onSaida}>Saída</button>}
        <BotoesLinha onEditar={onEditar} onExcluir={onExcluir} confirmacao={`Excluir o animal ${b.brinco} e todo o seu histórico? Para vendas ou mortes, prefira "Saída".`} />
      </td>
    </tr>
  );
}

import { useMemo, useState } from 'react';
import { useFazenda } from '@/store/useFazenda';
import { Badge, BotoesLinha, Campo, Card, ModalForm, PageHeader, Stat, Vazio } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { useFormulario } from '@/components/useFormulario';
import { rotuloBovino } from '@/lib/hooks';
import { emCarencia, manejosPendentes } from '@/lib/alertas';
import { diffDias, formatarData, hoje, somarDias } from '@/lib/datas';
import type { ManejoSanitario, TipoManejoSanitario } from '@/types';

const TIPOS: TipoManejoSanitario[] = ['vacina', 'vermífugo', 'medicamento', 'exame', 'outro'];

const vazio = (): Omit<ManejoSanitario, 'id'> => ({
  especie: 'bovino', alvo: 'rebanho', tipo: 'vacina', produto: '', data: hoje(),
});

export default function Sanidade() {
  const { sanidade, bovinos, lotesAves, adicionar, atualizar, remover } = useFazenda();
  const f = useFormulario(vazio);
  const [especie, setEspecie] = useState<'' | 'bovino' | 'ave'>('');
  const [aba, setAba] = useState<'agenda' | 'historico'>('agenda');
  const H = hoje();

  const nomeAlvo = (m: ManejoSanitario) => {
    if (m.alvo === 'rebanho') return m.especie === 'bovino' ? 'Todo o rebanho' : 'Todas as aves';
    if (m.alvo === 'animal') return rotuloBovino(bovinos.find((b) => b.id === m.alvoId));
    return lotesAves.find((l) => l.id === m.alvoId)?.codigo ?? '—';
  };

  const pendentes = useMemo(
    () => manejosPendentes(sanidade).filter((m) => !especie || m.especie === especie).sort((a, b) => a.proximaDose!.localeCompare(b.proximaDose!)),
    [sanidade, especie],
  );
  const historico = useMemo(
    () => sanidade.filter((m) => !especie || m.especie === especie).sort((a, b) => b.data.localeCompare(a.data)),
    [sanidade, especie],
  );
  const carencias = emCarencia(sanidade, H);
  const atrasados = pendentes.filter((m) => m.proximaDose! < H).length;

  const salvar = () => {
    const v = f.valores;
    if (!v.produto.trim()) return alert('Informe o produto.');
    if (v.alvo !== 'rebanho' && !v.alvoId) return alert('Selecione o animal ou lote.');
    const dados: Omit<ManejoSanitario, 'id'> = {
      ...v,
      alvoId: v.alvo === 'rebanho' ? undefined : v.alvoId,
      proximaDose: v.proximaDose || undefined,
      carenciaDias: v.carenciaDias || undefined,
    };
    if (f.editandoId) atualizar('sanidade', f.editandoId, dados);
    else adicionar('sanidade', dados);
    f.fechar();
  };

  /** Abre o formulário já preenchido para registrar a aplicação da próxima dose. */
  const aplicar = (m: ManejoSanitario) =>
    f.abrir({ ...m, id: undefined, data: H, proximaDose: undefined, observacoes: undefined });

  return (
    <div className="stack">
      <PageHeader titulo="Sanidade" subtitulo="Calendário de vacinas, vermifugações, medicamentos e períodos de carência">
        <select value={especie} onChange={(e) => setEspecie(e.target.value as typeof especie)} style={{ width: 'auto' }}>
          <option value="">Bovinos e aves</option>
          <option value="bovino">Bovinos</option>
          <option value="ave">Aves</option>
        </select>
        <button className="btn primary" onClick={() => f.abrir({ especie: especie || 'bovino' })}><Icone nome="mais" tamanho={16} />Novo manejo</button>
      </PageHeader>

      <div className="grid stats">
        <Stat rotulo="Doses atrasadas" valor={atrasados} tom={atrasados ? 'negativo' : undefined} />
        <Stat rotulo="Próximos 30 dias" valor={pendentes.filter((m) => m.proximaDose! >= H && diffDias(H, m.proximaDose!) <= 30).length} />
        <Stat rotulo="Em carência" valor={carencias.length} sub="Não abater / não vender leite ou ovos" />
        <Stat rotulo="Manejos registrados" valor={sanidade.length} />
      </div>

      {carencias.length > 0 && (
        <Card titulo="Períodos de carência ativos">
          <div className="actions">
            {carencias.map((m) => (
              <Badge key={m.id} tom="vermelho">{nomeAlvo(m)} · {m.produto} · até {formatarData(somarDias(m.data, m.carenciaDias!))}</Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="tabs">
        <button className={aba === 'agenda' ? 'active' : ''} onClick={() => setAba('agenda')}>Próximas doses</button>
        <button className={aba === 'historico' ? 'active' : ''} onClick={() => setAba('historico')}>Histórico</button>
      </div>

      <Card flush>
        {aba === 'agenda' ? (
          pendentes.length === 0 ? <Vazio titulo="Nenhuma dose agendada">Informe a "próxima dose" ao registrar um manejo.</Vazio> : (
            <div className="table-wrap">
              <table className="tabela">
                <thead><tr><th>Próxima dose</th><th>Prazo</th><th>Produto</th><th>Tipo</th><th>Aplicar em</th><th>Última aplicação</th><th /></tr></thead>
                <tbody>
                  {pendentes.map((m) => {
                    const dias = diffDias(H, m.proximaDose!);
                    return (
                      <tr key={m.id}>
                        <td>{formatarData(m.proximaDose)}</td>
                        <td><Badge tom={dias < 0 ? 'vermelho' : dias <= 7 ? 'amarelo' : 'neutro'}>{dias < 0 ? `${-dias} d atrasada` : dias === 0 ? 'hoje' : `em ${dias} d`}</Badge></td>
                        <td><strong>{m.produto}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{m.tipo}</td>
                        <td>{nomeAlvo(m)}</td>
                        <td>{formatarData(m.data)}</td>
                        <td className="acoes"><button className="btn small" onClick={() => aplicar(m)}><Icone nome="check" tamanho={14} />Aplicar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : historico.length === 0 ? <Vazio titulo="Nenhum manejo registrado" /> : (
          <div className="table-wrap">
            <table className="tabela">
              <thead><tr><th>Data</th><th>Espécie</th><th>Tipo</th><th>Produto</th><th>Dose</th><th>Aplicado em</th><th>Carência</th><th>Próxima</th><th>Responsável</th><th /></tr></thead>
              <tbody>
                {historico.map((m) => (
                  <tr key={m.id}>
                    <td>{formatarData(m.data)}</td>
                    <td><Badge tom={m.especie === 'bovino' ? 'marrom' : 'azul'}>{m.especie === 'bovino' ? 'Bovino' : 'Ave'}</Badge></td>
                    <td style={{ textTransform: 'capitalize' }}>{m.tipo}</td>
                    <td>{m.produto}</td>
                    <td>{m.dose ?? '—'}</td>
                    <td>{nomeAlvo(m)}</td>
                    <td>{m.carenciaDias ? `${m.carenciaDias} d` : '—'}</td>
                    <td>{formatarData(m.proximaDose)}</td>
                    <td>{m.responsavel ?? '—'}</td>
                    <td className="acoes"><BotoesLinha onEditar={() => f.abrir(m)} onExcluir={() => remover('sanidade', m.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalForm aberto={f.aberto} titulo={f.editandoId ? 'Editar manejo sanitário' : 'Novo manejo sanitário'} onFechar={f.fechar} onSalvar={salvar}>
        <Campo rotulo="Espécie">
          <select value={f.valores.especie} onChange={(e) => f.setValores((v) => ({ ...v, especie: e.target.value as 'bovino' | 'ave', alvo: 'rebanho', alvoId: undefined }))}>
            <option value="bovino">Bovinos</option>
            <option value="ave">Aves</option>
          </select>
        </Campo>
        <Campo rotulo="Aplicação">
          <select value={f.valores.alvo} onChange={(e) => f.setValores((v) => ({ ...v, alvo: e.target.value as ManejoSanitario['alvo'], alvoId: undefined }))}>
            <option value="rebanho">{f.valores.especie === 'bovino' ? 'Todo o rebanho' : 'Todas as aves'}</option>
            {f.valores.especie === 'bovino' ? <option value="animal">Animal individual</option> : <option value="lote">Lote específico</option>}
          </select>
        </Campo>
        {f.valores.alvo === 'animal' && (
          <Campo rotulo="Animal" full>
            <select {...f.campo('alvoId')} required>
              <option value="">Selecione…</option>
              {bovinos.filter((b) => b.status === 'ativo' || b.id === f.valores.alvoId).map((b) => <option key={b.id} value={b.id}>{rotuloBovino(b)}</option>)}
            </select>
          </Campo>
        )}
        {f.valores.alvo === 'lote' && (
          <Campo rotulo="Lote" full>
            <select {...f.campo('alvoId')} required>
              <option value="">Selecione…</option>
              {lotesAves.map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Tipo">
          <select {...f.campo('tipo')}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </Campo>
        <Campo rotulo="Produto *"><input {...f.campo('produto')} required /></Campo>
        <Campo rotulo="Dose / via"><input {...f.campo('dose')} placeholder="ex.: 2 ml subcutâneo" /></Campo>
        <Campo rotulo="Data da aplicação"><input type="date" {...f.campo('data')} required /></Campo>
        <Campo rotulo="Próxima dose" dica="Gera lembrete no painel">
          <input type="date" {...f.campo('proximaDose')} />
        </Campo>
        <Campo rotulo="Carência (dias)"><input type="number" min={0} {...f.campo('carenciaDias')} /></Campo>
        <Campo rotulo="Responsável"><input {...f.campo('responsavel')} /></Campo>
        <Campo rotulo="Observações"><input {...f.campo('observacoes')} /></Campo>
        <div className="full actions">
          {[30, 90, 180, 365].map((d) => (
            <button type="button" key={d} className="btn small" onClick={() => f.definir('proximaDose', somarDias(f.valores.data, d))}>Repetir em {d} dias</button>
          ))}
        </div>
      </ModalForm>
    </div>
  );
}

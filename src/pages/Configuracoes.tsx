import { useRef, useState } from 'react';
import { exportarDados, useFazenda } from '@/store/useFazenda';
import { Campo, Card, PageHeader } from '@/components/ui';
import { Icone } from '@/components/Icone';
import { hoje } from '@/lib/datas';
import type { Configuracao, DadosFazenda } from '@/types';
import { useSync } from '@/sync/motor';
import { CardConta, CardUsuarios } from './ContaUsuarios';

export default function Configuracoes() {
  const s = useFazenda();
  const [cfg, setCfg] = useState<Configuracao>(s.config);
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const admin = useSync((x) => x.sessao?.usuario.papel === 'admin');

  const set = <K extends keyof Configuracao>(k: K, v: Configuracao[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    s.atualizarConfig(cfg);
    setMsg('Configurações salvas.');
  };

  const baixarBackup = () => {
    const json = JSON.stringify(exportarDados(useFazenda.getState()), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-estancia-${hoje()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = async (file?: File) => {
    if (!file) return;
    try {
      const dados = JSON.parse(await file.text()) as DadosFazenda;
      if (!dados || typeof dados !== 'object' || !Array.isArray(dados.bovinos)) throw new Error('formato inválido');
      if (!confirm('Importar este backup substituirá TODOS os dados da estância, para todos os usuários. Continuar?')) return;
      s.importar(dados);
      setCfg(useFazenda.getState().config);
      setMsg('Backup importado com sucesso.');
    } catch (err) {
      alert(`Não foi possível importar o arquivo: ${(err as Error).message}`);
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  return (
    <div className="stack">
      <PageHeader titulo="Configurações" subtitulo="Dados da estância, parâmetros de cálculo e backup" />
      <div className="grid cols-2">
        <Card titulo="Estância">
          <form onSubmit={salvar}>
            <div className="form-grid">
              <Campo rotulo="Nome da estância" full><input value={cfg.nomeEstancia} onChange={(e) => set('nomeEstancia', e.target.value)} /></Campo>
              <Campo rotulo="Proprietário"><input value={cfg.proprietario} onChange={(e) => set('proprietario', e.target.value)} /></Campo>
              <Campo rotulo="Município / UF"><input value={cfg.municipio} onChange={(e) => set('municipio', e.target.value)} /></Campo>
              <Campo rotulo="Área total (ha)"><input type="number" min={0} value={cfg.areaTotalHa} onChange={(e) => set('areaTotalHa', Number(e.target.value))} /></Campo>
              <Campo rotulo="Preço da arroba (R$)" dica="Usado para estimar o valor do rebanho"><input type="number" min={0} step="0.01" value={cfg.precoArroba} onChange={(e) => set('precoArroba', Number(e.target.value))} /></Campo>
              <Campo rotulo="Preço da dúzia de ovos (R$)"><input type="number" min={0} step="0.01" value={cfg.precoDuziaOvos} onChange={(e) => set('precoDuziaOvos', Number(e.target.value))} /></Campo>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn primary" type="submit">Salvar</button>
              {msg && <span className="muted small">{msg}</span>}
            </div>
          </form>
        </Card>
        <div className="stack">
          <CardConta />
          <Card titulo="Backup dos dados" subtitulo="Os dados ficam no servidor e em cada aparelho. O arquivo de backup é uma cópia extra.">
            <div className="actions">
              <button className="btn" onClick={baixarBackup}><Icone nome="download" tamanho={16} />Baixar backup (.json)</button>
              {admin && <button className="btn" onClick={() => arquivo.current?.click()}><Icone nome="upload" tamanho={16} />Importar backup</button>}
              <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(e) => importar(e.target.files?.[0])} />
            </div>
          </Card>
          {admin && (
            <Card titulo="Dados de demonstração" subtitulo="Atenção: estas ações valem para todos os usuários da estância.">
              <div className="actions">
                <button className="btn" onClick={() => confirm('Substituir TODOS os dados da estância (para todos os usuários) pela estância de demonstração?') && (s.carregarDemo(), setCfg(useFazenda.getState().config))}>Carregar demonstração</button>
                <button className="btn danger" onClick={() => confirm('Apagar TODOS os dados da estância, para todos os usuários? Esta ação não pode ser desfeita (exceto por um backup).') && (s.limparTudo(), setCfg(useFazenda.getState().config))}><Icone nome="lixo" tamanho={16} />Começar do zero</button>
              </div>
            </Card>
          )}
          <Card titulo="Referências de cálculo">
            <dl className="dl small">
              <dt>Unidade Animal (UA)</dt><dd>450 kg de peso vivo</dd>
              <dt>Arroba</dt><dd>15 kg de carcaça · rendimento de 50% sobre o peso vivo</dd>
              <dt>Gestação bovina</dt><dd>283 dias a partir da cobertura/IA</dd>
              <dt>GMD</dt><dd>(peso final − inicial) ÷ dias entre pesagens</dd>
              <dt>Categorias</dt><dd>&lt; 12 meses bezerro(a); 12–24 garrote/novilha; acima: boi/touro, vaca após 1º parto ou 36 meses</dd>
              <dt>Taxa de postura</dt><dd>ovos do dia ÷ aves vivas</dd>
            </dl>
          </Card>
        </div>
      </div>
      {admin && <CardUsuarios />}
    </div>
  );
}

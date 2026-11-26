import { useEffect, type ReactNode } from 'react';
import { Icone } from './Icone';

export function PageHeader({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Card({ titulo, subtitulo, acoes, children, flush, className = '' }: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`}>
      {(titulo || acoes) && (
        <header>
          <div>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acoes && <div className="actions">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ rotulo, valor, sub, tom }: { rotulo: ReactNode; valor: ReactNode; sub?: ReactNode; tom?: 'positivo' | 'negativo' }) {
  return (
    <div className="card">
      <div className={`stat ${tom ?? ''}`}>
        <span className="label">{rotulo}</span>
        <span className="valor">{valor}</span>
        {sub && <span className="sub">{sub}</span>}
      </div>
    </div>
  );
}

export type Tom = 'verde' | 'vermelho' | 'amarelo' | 'azul' | 'marrom' | 'neutro';

export function Badge({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`badge ${tom}`}>{children}</span>;
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function Modal({ aberto, titulo, onFechar, children, rodape, largura }: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: number;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={largura ? { maxWidth: largura } : undefined}>
        <header>
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onFechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  );
}

/** Modal com formulário: o submit chama `onSalvar`. */
export function ModalForm({ aberto, titulo, onFechar, onSalvar, children, textoSalvar = 'Salvar', largura }: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  onSalvar: () => void;
  children: ReactNode;
  textoSalvar?: string;
  largura?: number;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto={aberto} titulo={titulo} onFechar={onFechar} largura={largura}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSalvar();
        }}
      >
        <div className="form-grid">{children}</div>
        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn primary">{textoSalvar}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Campo({ rotulo, children, full, dica }: { rotulo: string; children: ReactNode; full?: boolean; dica?: string }) {
  return (
    <label className={`campo ${full ? 'full' : ''}`}>
      <span>{rotulo}</span>
      {children}
      {dica && <span className="dica">{dica}</span>}
    </label>
  );
}

export function BotoesLinha({ onEditar, onExcluir, confirmacao = 'Excluir este registro?' }: {
  onEditar?: () => void;
  onExcluir?: () => void;
  confirmacao?: string;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {onEditar && (
        <button className="icon-btn" title="Editar" aria-label="Editar" onClick={onEditar}>
          <Icone nome="editar" tamanho={16} />
        </button>
      )}
      {onExcluir && (
        <button
          className="icon-btn danger"
          title="Excluir"
          aria-label="Excluir"
          onClick={() => window.confirm(confirmacao) && onExcluir()}
        >
          <Icone nome="lixo" tamanho={16} />
        </button>
      )}
    </span>
  );
}

export function Barra({ valor, max, nivel }: { valor: number; max: number; nivel?: 'alerta' | 'critico' }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <div className={`barra ${nivel ? nivel + '-barra' : ''}`} title={`${Math.round(pct)}%`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

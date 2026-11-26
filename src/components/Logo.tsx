// Marca Fazenda Ativa: um "A" (de Ativa) com um broto nascendo no topo.
// Arquivos oficiais (SVG/PNG) e guia de uso em marca/.

export function Simbolo({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="64" height="64" rx="15" fill="#2F5D34" />
      <path d="M14 51 L30 23 L46 51" fill="none" stroke="#F6F1E4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 42 H39" stroke="#F6F1E4" strokeWidth="5" strokeLinecap="round" />
      <path d="M32.5 20.5 C32 12 40 7 51 8.5 C51.5 18 43.5 22.5 32.5 20.5 Z" fill="#9CC56B" />
      <path d="M34 19.5 L45 12" stroke="#2F5D34" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Nome da marca em texto: "Fazenda" em peso médio, "Ativa" em destaque. */
export function NomeMarca({ claro }: { claro?: boolean }) {
  return (
    <span className={`nome-marca ${claro ? 'claro' : ''}`}>
      <span className="fazenda">Fazenda</span> <span className="ativa">Ativa</span>
    </span>
  );
}

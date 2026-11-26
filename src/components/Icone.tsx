// Ícones SVG simples (traço), sem dependências externas.
const caminhos: Record<string, string> = {
  painel: 'M3 13h8V3H3zM13 21h8v-8h-8zM3 21h8v-6H3zM13 3v8h8V3z',
  boi: 'M4 6c1 2 3 3 5 3h6c2 0 4-1 5-3M7 9v6a5 5 0 0 0 10 0V9M10 15h.01M14 15h.01M10 19h4',
  galinha: 'M12 4c2 0 3 1.5 3 3v2l2 1-2 1c1 1 2 3 2 5a5 5 0 0 1-10 0c0-3 2-4 2-6V7c0-1.5 1-3 3-3zM10 21v-2M14 21v-2M11 2l1 2 1-2',
  saude: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10zM12 9v6M9 12h6',
  pasto: 'M3 20h18M5 20c0-4 2-7 2-7s2 3 2 7M11 20c0-6 2-10 2-10s2 4 2 10M17 20c0-3 1.5-5 1.5-5s1.5 2 1.5 5',
  estoque: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  dinheiro: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01',
  agenda: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  pessoas: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2L9 4 6 5l.5 2L5 8.5 3 8l-1 3 2 1v0l-2 1 1 3 2-.5L6.5 17 6 19l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3z',
  mais: 'M12 5v14M5 12h14',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  fechar: 'M6 6l12 12M18 6L6 18',
  voltar: 'M15 18l-6-6 6-6',
  ovo: 'M12 3c3.5 0 6 6 6 10a6 6 0 0 1-12 0c0-4 2.5-10 6-10z',
  balanca: 'M12 3v18M5 21h14M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  coracao: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  leite: 'M8 3h8M9 3v3l-2 3v12h10V9l-2-3V3M7 13h10',
  check: 'M5 12l5 5L20 7',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  upload: 'M12 20V8M6 14l6-6 6 6M4 4h16',
  lua: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  casa: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
};

export type NomeIcone = keyof typeof caminhos;

export function Icone({ nome, tamanho = 18 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={caminhos[nome]} />
    </svg>
  );
}

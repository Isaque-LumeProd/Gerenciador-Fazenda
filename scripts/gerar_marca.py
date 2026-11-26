"""Gera os arquivos da marca Fazenda Ativa (SVG com texto em contorno).

Uso: python3 scripts/gerar_marca.py
Requer: fonttools, uharfbuzz e a fonte Inter Display instalada.
"""
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "marca"
FONTES = Path("/usr/share/fonts/opentype/inter")

CORES = {
    "verde_campo": "#2F5D34",
    "verde_mata": "#1F3A22",
    "verde_broto": "#9CC56B",
    "ambar_sol": "#E8A33D",
    "creme_palha": "#F6F1E4",
    "carvao": "#22261F",
}


def simbolo(x: float = 0, y: float = 0, tamanho: float = 64) -> str:
    """O símbolo: um "A" (de Ativa) com um broto nascendo no topo."""
    s = tamanho / 64
    c = CORES
    return (
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<rect width="64" height="64" rx="15" fill="{c["verde_campo"]}"/>'
        f'<path d="M14 51 L30 23 L46 51" fill="none" stroke="{c["creme_palha"]}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="M21 42 H39" stroke="{c["creme_palha"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<path d="M32.5 20.5 C32 12 40 7 51 8.5 C51.5 18 43.5 22.5 32.5 20.5 Z" fill="{c["verde_broto"]}"/>'
        f'<path d="M34 19.5 L45 12" stroke="{c["verde_campo"]}" stroke-width="1.4" stroke-linecap="round"/>'
        "</g>"
    )


def texto_em_curvas(texto: str, arquivo: str, tamanho: float, x: float, linha_base: float, cor: str, tracking_em: float = -0.025):
    """Converte o texto em caminhos SVG, com kerning (HarfBuzz) e espaçamento entre letras."""
    caminho = FONTES / arquivo
    blob = hb.Blob.from_file_path(str(caminho))
    face = hb.Face(blob)
    fonte_hb = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(texto)
    buf.guess_segment_properties()
    hb.shape(fonte_hb, buf, {"kern": True, "liga": True})

    tt = TTFont(str(caminho))
    upem = tt["head"].unitsPerEm
    glyphset = tt.getGlyphSet()
    ordem = tt.getGlyphOrder()
    escala = tamanho / upem
    tracking = tracking_em * upem

    caminhos, cursor = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        nome = ordem[info.codepoint]
        pen = SVGPathPen(glyphset)
        tpen = TransformPen(pen, (escala, 0, 0, -escala, x + (cursor + pos.x_offset) * escala, linha_base))
        glyphset[nome].draw(tpen)
        d = pen.getCommands()
        if d:
            caminhos.append(d)
        cursor += pos.x_advance + tracking
    largura = (cursor - tracking) * escala
    return f'<path fill="{cor}" d="{" ".join(caminhos)}"/>', largura


def logo_horizontal(negativo: bool = False) -> str:
    c = CORES
    cor_fazenda = c["creme_palha"] if negativo else c["carvao"]
    cor_ativa = c["verde_broto"] if negativo else c["verde_campo"]
    alt, tam_simbolo, tam_texto = 96, 96, 58
    x_texto = tam_simbolo + 24
    base = 67
    p1, w1 = texto_em_curvas("Fazenda", "InterDisplay-Medium.otf", tam_texto, x_texto, base, cor_fazenda)
    espaco = tam_texto * 0.26
    p2, w2 = texto_em_curvas("Ativa", "InterDisplay-ExtraBold.otf", tam_texto, x_texto + w1 + espaco, base, cor_ativa)
    largura = round(x_texto + w1 + espaco + w2 + 4)
    fundo = f'<rect width="{largura + 48}" height="{alt + 48}" x="-24" y="-24" rx="20" fill="{c["verde_mata"]}"/>' if negativo else ""
    vb = f"-24 -24 {largura + 48} {alt + 48}" if negativo else f"0 0 {largura} {alt}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Fazenda Ativa">'
        f"{fundo}{simbolo(0, 0, tam_simbolo)}{p1}{p2}</svg>\n"
    )


def logo_vertical() -> str:
    c = CORES
    p1, w1 = texto_em_curvas("Fazenda", "InterDisplay-Medium.otf", 40, 0, 0, c["carvao"])
    p2, w2 = texto_em_curvas("Ativa", "InterDisplay-ExtraBold.otf", 40, 0, 0, c["verde_campo"])
    espaco = 40 * 0.26
    total = w1 + espaco + w2
    largura = max(total, 128) + 16
    x0 = (largura - total) / 2
    p1, _ = texto_em_curvas("Fazenda", "InterDisplay-Medium.otf", 40, x0, 176, c["carvao"])
    p2, _ = texto_em_curvas("Ativa", "InterDisplay-ExtraBold.otf", 40, x0 + w1 + espaco, 176, c["verde_campo"])
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {round(largura)} 192" role="img" aria-label="Fazenda Ativa">'
        f"{simbolo((largura - 128) / 2, 0, 128)}{p1}{p2}</svg>\n"
    )


def main():
    SAIDA.mkdir(exist_ok=True)
    (SAIDA / "fazenda-ativa-simbolo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Fazenda Ativa">{simbolo()}</svg>\n'
    )
    (SAIDA / "fazenda-ativa-horizontal.svg").write_text(logo_horizontal())
    (SAIDA / "fazenda-ativa-horizontal-negativo.svg").write_text(logo_horizontal(negativo=True))
    (SAIDA / "fazenda-ativa-vertical.svg").write_text(logo_vertical())
    (RAIZ / "public" / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{simbolo()}</svg>\n'
    )
    print("Arquivos gerados em", SAIDA)


if __name__ == "__main__":
    main()

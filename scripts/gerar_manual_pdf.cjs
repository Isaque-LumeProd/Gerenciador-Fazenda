// Gera docs/manual/Manual-Fazenda-Ativa.pdf a partir de docs/manual/manual.html.
// Uso: node scripts/gerar_manual_pdf.cjs   (requer Playwright/Chromium, poppler-utils e pypdf)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pasta = path.join(raiz, 'docs', 'manual');
const saida = path.join(pasta, 'Manual-Fazenda-Ativa.pdf');
const tmp = (n) => path.join(pasta, `_${n}`);
const MARGENS = { top: '18mm', bottom: '20mm', left: '17mm', right: '17mm' };

const html = fs
  .readFileSync(path.join(pasta, 'manual.html'), 'utf8')
  .replace('{{LOGO_NEGATIVO}}', fs.readFileSync(path.join(raiz, 'marca', 'fazenda-ativa-horizontal-negativo.svg'), 'utf8'))
  .replace('{{DIAGRAMA}}', fs.readFileSync(path.join(pasta, 'diagrama-sincronizacao.svg'), 'utf8'))
  .replace(/@page \{[^}]*\}/, '@page { size: A4; }');

const rodape = `<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#6b7164;padding:0 17mm;display:flex;justify-content:space-between;align-items:center">
  <span><b style="color:#2F5D34">Fazenda Ativa</b> · Manual de uso</span><span class="pageNumber"></span></div>`;

async function renderizar(navegador, parte, numeros = {}) {
  const arquivo = tmp('render.html');
  fs.writeFileSync(arquivo, html);
  const p = await navegador.newPage();
  await p.goto('file://' + arquivo, { waitUntil: 'networkidle' });
  await p.evaluate(({ parte, numeros }) => {
    if (parte === 'capa') {
      document.querySelectorAll('body > section:not(.capa)').forEach((s) => s.remove());
      Object.assign(document.querySelector('.capa').style, { margin: '0', height: '297mm', breakAfter: 'auto' });
    } else {
      document.querySelector('.capa').remove();
      for (const [sec, n] of Object.entries(numeros)) {
        const el = document.querySelector(`[data-pag="${sec}"]`);
        if (el) el.textContent = String(n);
      }
    }
  }, { parte, numeros });
  await p.evaluate(() => document.fonts.ready);
  const destino = tmp(`${parte}.pdf`);
  await p.pdf({
    path: destino,
    format: 'A4',
    printBackground: true,
    margin: parte === 'capa' ? { top: '0', bottom: '0', left: '0', right: '0' } : MARGENS,
    displayHeaderFooter: parte !== 'capa',
    headerTemplate: '<span></span>',
    footerTemplate: rodape,
  });
  await p.close();
  return destino;
}

/** Descobre em que página do miolo começa cada capítulo (o título abre a página). */
function mapearPaginas(pdf) {
  const texto = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const titulos = [...html.matchAll(/data-sec="(s\d+)"><span class="num">(\d+)<\/span>([^<]+)</g)].map((m) => ({ sec: m[1], n: m[2], titulo: m[3] }));
  const mapa = {};
  texto.split('\f').forEach((pagina, i) => {
    const primeira = pagina.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    for (const t of titulos) {
      if (!mapa[t.sec] && primeira.replace(/\s+/g, ' ').startsWith(`${t.n} ${t.titulo}`.replace(/\s+/g, ' ')))
        mapa[t.sec] = i + 1;
      if (!mapa[t.sec] && primeira.replace(/\s+/g, '').startsWith(`${t.n}${t.titulo}`.replace(/\s+/g, '')))
        mapa[t.sec] = i + 1;
    }
  });
  const faltando = titulos.filter((t) => !mapa[t.sec]).map((t) => t.titulo);
  if (faltando.length) throw new Error('Capítulos não localizados no PDF: ' + faltando.join(', '));
  return mapa;
}

(async () => {
  const navegador = await chromium.launch();
  const capa = await renderizar(navegador, 'capa');
  const rascunho = await renderizar(navegador, 'miolo');
  const numeros = mapearPaginas(rascunho);
  const miolo = await renderizar(navegador, 'miolo', numeros);
  await navegador.close();

  // Junta capa + miolo e grava os metadados do documento.
  execFileSync('python3', ['-c', `
import sys
from pypdf import PdfReader, PdfWriter
w = PdfWriter()
for f in sys.argv[1:3]:
    for pg in PdfReader(f).pages:
        w.add_page(pg)
w.add_metadata({"/Title": "Fazenda Ativa — Manual de uso", "/Author": "Fazenda Ativa", "/Subject": "Manual de uso do sistema de gestão de gado e aves"})
w.write(sys.argv[3])
`, capa, miolo, saida]);
  for (const f of ['render.html', 'capa.pdf', 'miolo.pdf']) fs.rmSync(tmp(f), { force: true });
  console.log('Capítulos:', numeros);
  console.log('PDF gerado:', saida);
})().catch((e) => { console.error(e); process.exit(1); });

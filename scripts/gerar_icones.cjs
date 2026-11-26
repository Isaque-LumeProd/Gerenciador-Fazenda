// Gera PNGs da marca e ícones do app a partir dos SVGs de marca/.
// Uso: node scripts/gerar_icones.cjs  (requer Playwright com Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const svg = (nome) => fs.readFileSync(path.join(raiz, 'marca', nome), 'utf8');
const simbolo = svg('fazenda-ativa-simbolo.svg');
// Versão "maskable": fundo verde até a borda e o símbolo dentro da área segura (80%).
const conteudoSimbolo = simbolo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2F5D34"/><g transform="translate(9.6 9.6) scale(0.7)">${conteudoSimbolo}</g></svg>`;
// iOS arredonda o ícone sozinho: fundo cheio, sem cantos.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2F5D34"/><g transform="translate(4 4) scale(0.875)">${conteudoSimbolo}</g></svg>`;

const alvos = [
  ['public/icone-192.png', simbolo, 192, 192],
  ['public/icone-512.png', simbolo, 512, 512],
  ['public/icone-maskable-512.png', maskable, 512, 512],
  ['public/apple-touch-icon.png', apple, 180, 180],
  ['marca/fazenda-ativa-simbolo-1024.png', simbolo, 1024, 1024],
  ['marca/fazenda-ativa-horizontal.png', svg('fazenda-ativa-horizontal.svg'), 1458, 288],
  ['marca/fazenda-ativa-horizontal-negativo.png', svg('fazenda-ativa-horizontal-negativo.svg'), 1602, 432],
  ['marca/fazenda-ativa-vertical.png', svg('fazenda-ativa-vertical.svg'), null, 576],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [destino, conteudo, w0, h] of alvos) {
    const vb = conteudo.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const w = w0 ?? Math.round((vb[2] / vb[3]) * h);
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${conteudo.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    await p.screenshot({ path: path.join(raiz, destino), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    console.log('ok', destino, `${w}x${h}`);
  }
  await b.close();
})();

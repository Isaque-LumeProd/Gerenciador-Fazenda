// Captura as telas usadas no manual em PDF.
// Pré-requisito: `npm run build` e `npm run preview` rodando em http://localhost:4173 com banco local vazio.
const { chromium, devices } = require('playwright');
const path = require('path');

const U = process.env.URL_APP ?? 'http://localhost:4173/';
const DEST = path.join(__dirname, '..', 'docs', 'manual', 'imagens');
const foto = (p, nome, opcoes = {}) => p.screenshot({ path: path.join(DEST, `${nome}.jpg`), type: 'jpeg', quality: 86, ...opcoes });
const sincronizado = (p) => p.locator('.status-sync').filter({ hasText: 'Sincronizado' }).first().waitFor({ timeout: 30000 });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const ir = async (rota) => { await p.goto(U + '#/' + rota); await p.waitForTimeout(500); };

  await p.goto(U);
  await p.getByRole('button', { name: 'Criar estância' }).waitFor();
  await foto(p, 'cadastro');
  await p.getByLabel('Nome da estância').fill('Estância Boa Vista');
  await p.getByLabel('Seu nome').fill('Ana Souza');
  await p.getByLabel('E-mail').fill('ana@boavista.com.br');
  await p.getByLabel('Senha').fill('demonstracao1');
  await p.getByRole('button', { name: 'Criar estância' }).click();
  await sincronizado(p);
  await ir('configuracoes');
  await p.getByRole('button', { name: 'Carregar demonstração' }).click();
  await p.waitForTimeout(800);
  await sincronizado(p);
  await p.getByRole('button', { name: 'Usuário', exact: true }).click();
  await p.locator('.modal').getByLabel('Nome').fill('João da Silva');
  await p.locator('.modal').getByLabel('E-mail (login)').fill('joao@boavista.com.br');
  await p.locator('.modal').getByLabel('Senha inicial').fill('capataz2026');
  await p.locator('.modal button[type=submit]').click();
  await p.getByText('joao@boavista.com.br').waitFor();

  await ir(''); await foto(p, 'painel');
  await ir('bovinos'); await foto(p, 'rebanho');
  await p.getByRole('button', { name: 'Novo animal' }).click(); await p.waitForTimeout(300); await foto(p, 'novo-animal'); await p.keyboard.press('Escape');
  await ir('bovinos'); await p.locator('.busca input').fill('Mimosa'); await p.locator('tbody tr a').first().click(); await p.waitForTimeout(500); await foto(p, 'ficha-animal');
  await ir('bovinos/pesagens'); await p.getByRole('button', { name: 'Pesagem em lote' }).click(); await p.waitForTimeout(300);
  await p.locator('.modal select').first().selectOption({ label: 'Invernada do Arroio' });
  await p.locator('.modal tbody input').nth(0).fill('468'); await p.locator('.modal tbody input').nth(1).fill('472');
  await foto(p, 'pesagem-lote'); await p.keyboard.press('Escape');
  await ir('bovinos/reproducao'); await foto(p, 'reproducao');
  await ir('aves'); await foto(p, 'lotes-aves');
  await p.locator('tbody tr a').first().click(); await p.waitForTimeout(500); await foto(p, 'ficha-lote');
  await ir('aves/producao'); await foto(p, 'producao-diaria');
  await ir('sanidade'); await foto(p, 'sanidade');
  await ir('pastagens'); await foto(p, 'pastagens');
  await ir('estoque'); await foto(p, 'estoque');
  await ir('financeiro'); await foto(p, 'financeiro');
  await ir('agenda'); await foto(p, 'agenda');
  await ir('configuracoes'); await foto(p, 'configuracoes', { fullPage: true });

  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  await m.goto(U);
  await m.getByLabel('E-mail').fill('joao@boavista.com.br');
  await m.getByLabel('Senha').fill('capataz2026');
  await m.getByRole('button', { name: 'Entrar' }).click();
  await sincronizado(m);
  await m.waitForTimeout(500);
  await foto(m, 'celular-painel');
  await m.click('[aria-label="Abrir menu"]'); await m.waitForTimeout(400); await foto(m, 'celular-menu');
  await m.mouse.click(380, 300); await m.goto(U + '#/aves/producao'); await m.waitForTimeout(500); await foto(m, 'celular-producao');
  await m.context().setOffline(true);
  await m.goto(U + '#/bovinos'); await m.getByRole('button', { name: 'Novo animal' }).click();
  await m.locator('.modal').getByLabel('Brinco / identificação *').fill('516');
  await m.locator('.modal button[type=submit]').click();
  await m.locator('.status-sync').filter({ hasText: 'Sem internet' }).first().waitFor();
  await m.evaluate(() => window.scrollTo(0, 0));
  await foto(m, 'celular-offline');
  await b.close();
  console.log('telas capturadas em', DEST);
})().catch((e) => { console.error(e); process.exit(1); });

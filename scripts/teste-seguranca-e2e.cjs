const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
// Teste de segurança de ponta a ponta no navegador.
// Pré-requisito: `npm run build` e `npm run preview` rodando com banco local vazio (apague .dados-locais/).
// Uso: npm run teste:seguranca
const os = require('os');
const SP = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'seguranca-'));
const U = 'http://localhost:4173/';
const sinc = (p) => p.locator('.status-sync').filter({ hasText: 'Sincronizado' }).first().waitFor({ timeout: 30000 });
(async () => {
  const b = await chromium.launch();
  const violacoes = [];
  const erros = [];
  const vigiar = (p, nome) => {
    p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violacoes.push(`${nome}: ${m.text()}`); });
    p.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
    p.on('dialog', (d) => { if (d.type() === 'alert') console.log(`  [alerta ${nome}]`, d.message().split('\n')[0]); d.accept(); });
  };

  const ctxA = await b.newContext({ viewport: { width: 1280, height: 820 } });
  const a = await ctxA.newPage(); vigiar(a, 'admin');
  await a.goto(U);
  await a.getByLabel('Nome da estância').fill('Estância Teste');
  await a.getByLabel('Seu nome').fill('Ana');
  await a.getByLabel('E-mail').fill('ana@teste.com');
  await a.getByLabel('Senha').fill('senhaforte1');
  await a.getByRole('button', { name: 'Criar estância' }).click();
  await sinc(a);
  await a.goto(U + '#/configuracoes');
  await a.getByRole('button', { name: 'Carregar demonstração' }).click();
  await a.waitForTimeout(800); await sinc(a);
  await a.getByRole('button', { name: 'Usuário', exact: true }).click();
  await a.locator('.modal').getByLabel('Nome').fill('João');
  await a.locator('.modal').getByLabel('E-mail (login)').fill('joao@teste.com');
  await a.locator('.modal').getByLabel('Senha inicial').fill('capataz123');
  await a.locator('.modal button[type=submit]').click();
  await a.getByText('joao@teste.com').waitFor();

  // Percorre todas as telas procurando bloqueios da CSP
  for (const r of ['', 'bovinos', 'bovinos/pesagens', 'bovinos/reproducao', 'bovinos/leite', 'aves', 'aves/producao', 'sanidade', 'pastagens', 'estoque', 'financeiro', 'agenda', 'equipe', 'configuracoes']) {
    await a.goto(U + '#/' + r); await a.waitForTimeout(350);
  }
  await a.goto(U + '#/bovinos'); await a.locator('tbody tr a').first().click(); await a.waitForTimeout(400);
  await a.goto(U + '#/aves'); await a.locator('tbody tr a').first().click(); await a.waitForTimeout(400);
  console.log('Telas percorridas. Violações de CSP:', violacoes.length);

  // Membro apaga 3 animais
  const ctxB = await b.newContext({ ...devices['iPhone 13'] });
  const j = await ctxB.newPage(); vigiar(j, 'membro');
  await j.goto(U);
  await j.getByLabel('E-mail').fill('joao@teste.com'); await j.getByLabel('Senha').fill('capataz123');
  await j.getByRole('button', { name: 'Entrar' }).click(); await sinc(j);
  await j.goto(U + '#/configuracoes'); await j.waitForTimeout(400);
  console.log('Membro vê Lixeira?', await j.getByText('Lixeira', { exact: true }).count() > 0, '| vê Usuários?', await j.getByRole('heading', { name: 'Usuários' }).count() > 0);
  await j.goto(U + '#/bovinos');
  for (let i = 0; i < 3; i++) { await j.locator('tbody tr').first().getByRole('button', { name: 'Excluir' }).click(); await j.waitForTimeout(150); }
  await j.waitForTimeout(2200); await sinc(j);
  const antes = await j.evaluate(() => JSON.parse(localStorage['gerenciador-fazenda:v1']).state.bovinos.length);
  console.log('Bovinos no aparelho do membro após apagar 3:', antes);

  // Admin restaura pela Lixeira
  await a.goto(U + '#/configuracoes'); await a.waitForTimeout(400);
  await a.getByRole('button', { name: 'Atualizar' }).click(); await a.waitForTimeout(600);
  const linhas = await a.locator('section.card', { hasText: 'Lixeira' }).locator('tbody tr').count();
  console.log('Itens na Lixeira:', linhas, '|', (await a.locator('section.card', { hasText: 'Lixeira' }).locator('tbody tr').first().innerText()).replace(/\s+/g, ' '));
  await a.locator('section.card', { hasText: 'Lixeira' }).screenshot({ path: path.join(SP, 'lixeira.png') });
  await a.getByRole('button', { name: 'Restaurar todos' }).click();
  await a.waitForTimeout(1200);
  await j.locator('.topbar .status-sync').click(); await j.waitForTimeout(800); await sinc(j);
  console.log('Bovinos no aparelho do membro após restaurar:', await j.evaluate(() => JSON.parse(localStorage['gerenciador-fazenda:v1']).state.bovinos.length));

  // Importar backup adulterado
  const backup = JSON.parse(await a.evaluate(() => localStorage['gerenciador-fazenda:v1'])).state;
  backup.bovinos[0].brinco = { '$ne': null };
  const arq = path.join(SP, 'backup-adulterado.json');
  fs.writeFileSync(arq, JSON.stringify(backup));
  await a.locator('input[type=file]').setInputFiles(arq);
  await a.waitForTimeout(600);
  console.log('Brinco do 1º animal continua texto?', await a.evaluate(() => typeof JSON.parse(localStorage['gerenciador-fazenda:v1']).state.bovinos[0].brinco === 'string'));

  // Força bruta pela tela de login
  const ctxC = await b.newContext();
  const c = await ctxC.newPage(); vigiar(c, 'atacante');
  await c.goto(U);
  let ultima = '';
  for (let i = 0; i < 6; i++) {
    await c.getByLabel('E-mail').fill('ana@teste.com'); await c.getByLabel('Senha').fill('chute' + i + 'xyz');
    await c.getByRole('button', { name: 'Entrar' }).click(); await c.waitForTimeout(500);
    ultima = await c.locator('.aviso-erro').innerText().catch(() => '');
  }
  console.log('Mensagem após 6 tentativas:', ultima);

  // Sem internet continua funcionando com a CSP
  await ctxB.setOffline(true);
  await j.reload(); await j.locator('h1').waitFor({ timeout: 10000 });
  console.log('Abre sem internet com CSP:', await j.locator('h1').first().innerText());

  console.log('VIOLAÇÕES CSP:', violacoes);
  console.log('ERROS:', erros);
  await b.close();
  if (violacoes.length || erros.length) process.exit(1);
})().catch((e) => { console.error('FALHOU', e); process.exit(1); });

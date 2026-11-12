// Uso: node banco.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]  (API com DATABASE_URL em :8000 e front em :3000)
// B2: o cidadão manda foto → a gestora vê a foto (borrada, link do Storage) e o histórico na fila; observação vai para o histórico.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const FOTO = require('path').join(__dirname, '../../../api/tests/fixtures/rua_rdd2022.jpg');
const temas = (process.argv[3] || 'claro').split(',');
const W = 'http://localhost:3000';
const erros = [];
async function novo(browser, tema, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'pt-BR',
    geolocation: { latitude: -23.5617, longitude: -46.6560 }, permissions: ['geolocation'] });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [], avisosSom: false })); }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403|Failed to load resource/.test(m.text())) erros.push(`${tema} console: ${m.text()}`); });
  return { ctx, page };
}
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true });
(async () => {
  const browser = await chromium.launch();
  for (const tema of temas) {
    const t = tema.slice(0, 2);
    let { ctx, page } = await novo(browser, tema, { width: 390, height: 844 });
    await page.goto(`${W}/reportar`);
    await page.getByLabel('Descreva o problema').fill('Buraco enorme no asfalto da rua, carro quase caiu nele hoje');
    await page.locator('input[type=file]:not([capture])').setInputFiles(FOTO);
    await page.getByAltText('Prévia da foto escolhida').waitFor();
    await page.getByRole('button', { name: 'Usar minha localização' }).click();
    await page.getByText('Localização pega').waitFor();
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByRole('heading', { name: /Isso parece ser/ }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /continuar/i }).first().click();
    await page.getByText('Confira antes de enviar').waitFor();
    await shot(page, `1-${t}-confirmacao-com-foto`);
    await page.getByRole('button', { name: 'Confirmar e gerar solicitação' }).click();
    await page.getByText('Solicitação gerada').waitFor();
    const protocolo = (await page.getByText(/QR-\d{6}-/).first().textContent()).match(/QR-\d{6}-[0-9A-F]{5}/)[0];
    const oc = await page.evaluate(() => JSON.parse(localStorage.getItem('quem-resolve:v1')).meusReportes[0]);
    const id = oc.id ?? oc.ocorrencia?.id;
    console.log(tema, 'protocolo:', protocolo);
    await ctx.close();

    ({ ctx, page } = await novo(browser, tema, { width: 1280, height: 900 }));
    await page.goto(`${W}/gestao/entrar`);
    await page.getByLabel('Usuário').fill('marina'); await page.getByLabel('Senha').fill('demo-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((u) => u.pathname === '/gestao');
    await page.goto(`${W}/gestao/filas?responsavel=subprefeitura&abrir=${id}`);
    await page.getByText(/problemas? ·/).waitFor();
    const foto = page.getByAltText(`Foto da ocorrência ${protocolo}`);
    await foto.waitFor();
    console.log(tema, 'foto na fila:', (await foto.getAttribute('src')).slice(0, 30));
    await page.getByText('Nenhuma mudança ainda.').waitFor();
    await page.getByLabel('Mudar status').selectOption('enviada');
    await page.getByLabel(/Observação/).fill('Mandei pelo SP156');
    await page.getByRole('button', { name: 'Salvar status' }).click();
    await page.getByText('Status salvo').waitFor();
    await page.getByText('“Mandei pelo SP156”').waitFor();
    console.log(tema, 'histórico:', (await page.getByRole('region', { name: 'Histórico de mudanças' }).locator('li').first().innerText()).replace(/\n/g, ' | '));
    await shot(page, `2-${t}-fila-foto-historico`);
    await ctx.close();
  }
  console.log(erros.length ? `ERROS:\n${erros.join('\n')}` : 'sem erros de página');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

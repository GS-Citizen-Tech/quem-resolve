const { chromium } = require('playwright');
// Prints do novo Reportar e da tela inicial (docs/PLANO-UX-REPORTAR.md).
// Uso: node ux.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]   (API em :8000 com GEO_PROVIDER=mock e front em :3000)
const OUT = process.argv[2];
const FOTO = require('path').join(__dirname, '../../../api/tests/fixtures/rua_rdd2022.jpg');
const temas = (process.argv[3] || 'claro,escuro,alto-contraste').split(',');
const erros = [];
async function novo(browser, tema, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'pt-BR',
    geolocation: opts.semLocal ? undefined : { latitude: -23.5557, longitude: -46.6622 }, permissions: opts.semLocal ? [] : ['geolocation'] });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [] })); }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|Failed to load resource/.test(m.text())) erros.push(`${tema} console: ${m.text()}`); });
  return { ctx, page };
}
const shot = (page, nome, inteira = false) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: inteira });
(async () => {
  const browser = await chromium.launch();
  const mob = { width: 390, height: 844 };
  for (const tema of temas) {
    const t = tema.slice(0, 2);
    // 1. Tela inicial: bola, foto/escrever, exemplos e "Você está em"
    let { ctx, page } = await novo(browser, tema, mob);
    await page.goto('http://localhost:3000/');
    await page.getByText('Rua Augusta, 900', { exact: true }).waitFor();
    await page.waitForTimeout(700);
    await shot(page, `1-${t}-inicio`);
    // 2. Exemplo "Buraco na rua" → cartões com o local já preenchido
    await page.getByRole('link', { name: 'Buraco na rua' }).click();
    await page.getByRole('region', { name: 'Local' }).getByText('Rua Augusta, 900 · Consolação').waitFor();
    await page.getByLabel('Descreva o problema').fill('Tem um buraco na rua bem na frente do ponto de ônibus');
    await page.locator('input[type=file]:not([capture])').setInputFiles(FOTO);
    await page.getByAltText('Prévia da foto escolhida').waitFor();
    await page.waitForTimeout(600);
    await shot(page, `2-${t}-cartoes`);
    await page.mouse.wheel(0, 2000); await page.waitForTimeout(400);
    await shot(page, `2-${t}-cartoes-fim`);
    // 3. Mapa em tela cheia: arrastar, endereço ao vivo, busca
    await page.getByRole('button', { name: 'Não é aqui? Ajustar no mapa' }).click();
    await page.getByText('Você está marcando').waitFor();
    const mapa = page.getByRole('region', { name: /arraste até o pino/ });
    const b = await mapa.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 - 120, b.y + b.height / 2 + 160, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(1200);
    await shot(page, `3-${t}-mapa-arrastado`);
    await page.getByLabel('Procurar endereço').fill('paulista');
    await page.getByRole('button', { name: 'Procurar' }).click();
    await page.getByRole('button', { name: /Avenida Paulista, 1578/ }).waitFor();
    await shot(page, `3-${t}-mapa-busca`);
    await page.getByRole('button', { name: /Avenida Paulista, 1578/ }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Usar este local' }).click();
    await page.getByText('Você marcou no mapa').waitFor();
    await page.getByText('Avenida Paulista, 1578 · Bela Vista').waitFor();
    await page.getByText('Você marcou no mapa').scrollIntoViewIfNeeded();
    await shot(page, `3-${t}-local-escolhido`);
    // 5. Segue o fluxo até a confirmação (o endereço aparece no resumo)
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByRole('heading', { name: /Isso parece ser/ }).waitFor({ timeout: 25000 });
    await page.getByRole('button', { name: 'Está certo, continuar' }).click();
    await page.getByText('Confira antes de enviar').waitFor();
    await page.waitForTimeout(500);
    await shot(page, `5-${t}-confirmacao`, true);
    await ctx.close();

    // 4. Sem localização do aparelho: o cartão explica e o botão final diz o que falta
    ({ ctx, page } = await novo(browser, tema, mob, { semLocal: true }));
    await page.goto('http://localhost:3000/reportar?escrever=1');
    await page.getByText('Não consegui sua localização').waitFor();
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.waitForTimeout(400);
    await shot(page, `4-${t}-sem-local`, true);
    await page.getByRole('button', { name: 'Procurar endereço ou marcar no mapa' }).click();
    await page.getByText('Você está marcando').waitFor(); await page.waitForTimeout(800);
    await shot(page, `4-${t}-sem-local-mapa`);
    await ctx.close();
  }
  // 6. Desktop (tema claro)
  const { ctx, page } = await novo(browser, 'claro', { width: 1280, height: 860 });
  await page.goto('http://localhost:3000/');
  await page.getByText('Rua Augusta, 900', { exact: true }).waitFor(); await page.waitForTimeout(600);
  await shot(page, '6-desktop-inicio');
  await page.goto('http://localhost:3000/reportar');
  await page.getByText('Rua Augusta, 900 · Consolação').waitFor(); await page.waitForTimeout(600);
  await shot(page, '6-desktop-reportar', true);
  await ctx.close();
  await browser.close();
  console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
})();

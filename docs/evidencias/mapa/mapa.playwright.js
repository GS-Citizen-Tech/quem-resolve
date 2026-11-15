// Prints do mapa novo do console (docs/PLANO-MAPA-CONSOLE.md): cidade com bairros pintados, bairro focado, ponto clicado.
// Uso: node mapa.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]  (API em :8000 com a malha de distritos e front em :3000)
const { chromium } = require('playwright');
const OUT = process.argv[2];
const temas = (process.argv[3] || 'claro,escuro,alto-contraste').split(',');
const W = 'http://localhost:3000';
const erros = [];
const DESK = { width: 1440, height: 900 }, MOB = { width: 390, height: 844 };
async function novo(browser, tema, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'pt-BR' });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [], avisosSom: false })); }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403|Failed to load resource|ERR_|tile/.test(m.text())) erros.push(`${tema} console: ${m.text()}`); });
  await page.goto(`${W}/gestao/entrar?volta=/gestao/mapa`);
  await page.getByLabel('Usuário').fill('marina');
  await page.getByLabel('Senha').fill('demo-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/gestao\/mapa/);
  await page.locator('.leaflet-overlay-pane path').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png` });
(async () => {
  const browser = await chromium.launch();
  for (const tema of temas) {
    const t = tema.slice(0, 2);
    let { ctx, page } = await novo(browser, tema, DESK);
    console.log(tema, 'bairros desenhados:', await page.locator('.leaflet-overlay-pane path').count(), '| bolas:', await page.locator('.leaflet-marker-icon').count());
    await shot(page, `1-${t}-cidade`);
    // passar o mouse num bairro mostra a dica
    const area = page.locator('.leaflet-overlay-pane path').nth(3);
    const b = await area.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400);
    console.log(tema, 'dica:', (await page.locator('.qr-dica').first().textContent().catch(() => '—')));
    // focar num bairro pela busca
    await page.getByLabel('Ir para o bairro').selectOption('itaquera');
    await page.getByRole('heading', { name: 'Itaquera', level: 2 }).waitFor();
    await page.waitForTimeout(1500);
    console.log(tema, 'URL:', page.url().replace(W, ''), '| bolas no bairro:', await page.locator('.leaflet-marker-icon').count());
    await shot(page, `2-${t}-bairro`);
    // clicar na maior bola
    const maior = await page.locator('.leaflet-marker-icon').evaluateAll((els) => { let i = 0, m = 0; els.forEach((e, k) => { const w = e.getBoundingClientRect().width; if (w > m) { m = w; i = k; } }); return i; });
    await page.locator('.leaflet-marker-icon').nth(maior).click();
    await page.getByRole('region', { name: 'Ponto escolhido' }).waitFor();
    await page.waitForTimeout(500);
    await shot(page, `3-${t}-ponto`);
    // voltar para a cidade pelo caminho
    await page.getByRole('button', { name: 'São Paulo' }).click();
    await page.getByText('São Paulo · toda a cidade').waitFor();
    await ctx.close();
    ({ ctx, page } = await novo(browser, tema, MOB));
    await shot(page, `4-${t}-celular`);
    await page.getByLabel('Ir para o bairro').selectOption('grajau');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/5-${t}-celular-bairro.png`, fullPage: true });
    await ctx.close();
  }
  await browser.close();
  console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
})();

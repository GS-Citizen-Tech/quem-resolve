// Uso: node f3.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]  (API em :8000 com SEED>0 e front em :3000)
// Caminhos da F3: sem login → Entrar → volta; login errado; filtros mudam o gráfico; reclassificar; marcar resolvida;
// outro órgão (403); mapa; frota com trajeto; qualidade; API fora do ar. Desktop 1280 e celular 390.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const temas = (process.argv[3] || 'claro,escuro,alto-contraste').split(',');
const W = 'http://localhost:3000', A = 'http://localhost:8000';
const erros = [];
const DESK = { width: 1280, height: 900 }, MOB = { width: 390, height: 844 };

async function novo(browser, tema, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, locale: 'pt-BR' });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [], avisosSom: false })); }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403|Failed to load resource|ERR_FAILED/.test(m.text())) erros.push(`${tema} console: ${m.text()}`); });
  return { ctx, page };
}
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true });
async function entrar(page, usuario = 'marina') {
  await page.getByLabel('Usuário').fill(usuario);
  await page.getByLabel('Senha').fill('demo-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const grafico = (page) => page.locator('.js-plotly-plot').first().waitFor({ timeout: 20000 });
const total = async (page) => (await page.locator('section:has(h2:text("Ocorrências")) p').first().textContent()).trim();

(async () => {
  const browser = await chromium.launch();
  for (const tema of temas) {
    const t = tema.slice(0, 2);

    // 1. Sem login → Entrar (login errado) → volta para a tela com o filtro
    let { ctx, page } = await novo(browser, tema, DESK);
    await page.goto(`${W}/gestao/filas?categoria=buraco`);
    await page.waitForURL(/\/gestao\/entrar\?volta=/);
    await page.getByLabel('Usuário').fill('marina'); await page.getByLabel('Senha').fill('errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByText('Usuário ou senha incorretos').waitFor();
    console.log(tema, 'login errado mantém o usuário:', await page.getByLabel('Usuário').inputValue());
    await shot(page, `1-${t}-entrar-erro`);
    await entrar(page);
    await page.waitForURL((u) => u.pathname === '/gestao/filas' && u.search.includes('categoria=buraco'));
    console.log(tema, 'voltou para:', page.url().replace(W, ''));

    // 2. Visão geral: filtros mudam os números e o gráfico
    await page.goto(`${W}/gestao`);
    await grafico(page);
    const antes = await total(page);
    await shot(page, `2-${t}-visao-geral`);
    await page.getByLabel('Órgão responsável', { exact: true }).selectOption('subprefeitura');
    await page.getByLabel('Categoria', { exact: true }).selectOption('buraco');
    await page.waitForFunction((a) => document.querySelector('section h2 + p')?.textContent?.trim() !== a, antes);
    await grafico(page);
    console.log(tema, 'total sem filtro:', antes, '→ com filtro:', await total(page), '| URL:', page.url().replace(W, ''));
    await shot(page, `2-${t}-visao-geral-filtrada`);
    await page.getByRole('link', { name: 'Mapa' }).last().click();
    await page.waitForURL(/\/gestao\/mapa\?.*categoria=buraco/);
    console.log(tema, 'filtro acompanha a troca de tela: ok');

    // 3. Mapa (Leaflet): pontos desenhados, ponto escolhido e resumo
    await page.getByRole('heading', { name: /Pontos no mapa/ }).waitFor();
    await page.locator('.leaflet-marker-icon').first().waitFor({ timeout: 15000 });
    console.log(tema, 'pontos no mapa:', await page.locator('.leaflet-marker-icon').count());
    await page.locator('ul button').first().click();
    await page.getByRole('link', { name: 'Abrir na fila' }).waitFor();
    await shot(page, `3-${t}-mapa`);

    // 4. Filas: reclassificar e marcar como resolvida
    await page.goto(`${W}/gestao/filas?categoria=buraco&status=pendente_envio`);
    await page.getByText(/problemas? ·/).waitFor();
    await page.locator('tbody button[aria-expanded]').first().click();
    await page.getByLabel('Mudar status').selectOption('resolvida');
    await page.getByRole('button', { name: 'Salvar status' }).click();
    await page.getByText('Status salvo').waitFor();
    await shot(page, `4-${t}-fila-resolvida`);
    await page.locator('tbody button[aria-expanded="false"]').first().click();
    await page.getByText('Reclassificar (categoria errada)').click();
    await page.locator('label:has-text("Árvore (poda ou queda)")').click();
    await page.getByRole('button', { name: 'Salvar nova categoria' }).click();
    await page.getByText('Reclassificada').waitFor();
    console.log(tema, 'reclassificada:', await page.getByText(/Agora é “/).textContent());
    await shot(page, `4-${t}-fila-reclassificada`);

    // 5. Frota com trajetos e "possivelmente resolvida"
    await page.goto(`${W}/gestao/frota`);
    await page.locator('#passagens-t').waitFor();
    await page.getByRole('button', { name: /Linha 3789-10/ }).first().click();
    await page.locator('.leaflet-overlay-pane path').first().waitFor({ state: 'attached', timeout: 15000 });
    console.log(tema, 'trajeto desenhado: ok');
    await shot(page, `5-${t}-frota`);

    // 6. Qualidade da IA
    await page.goto(`${W}/gestao/qualidade`);
    await page.getByRole('heading', { name: 'Módulos' }).waitFor();
    await shot(page, `6-${t}-qualidade`);

    // 7. API fora do ar: aviso + "Tentar de novo", filtros continuam
    await page.route(`${A}/ocorrencias/metricas**`, (r) => r.abort());
    await page.goto(`${W}/gestao?origem=frota`);
    await page.getByText('Sem conexão com o servidor').waitFor();
    console.log(tema, 'fora do ar, filtro origem continua:', await page.getByLabel('Origem', { exact: true }).inputValue());
    await shot(page, `7-${t}-api-fora`);
    await page.unroute(`${A}/ocorrencias/metricas**`);
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await grafico(page);
    console.log(tema, 'tentar de novo: ok');
    await ctx.close();

    // 8. Outro órgão (João, Sabesp): vê a fila da subprefeitura mas não altera (403)
    ({ ctx, page } = await novo(browser, tema, DESK));
    await page.goto(`${W}/gestao/entrar`);
    await entrar(page, 'joao');
    await page.waitForURL((u) => u.pathname === '/gestao');
    await page.goto(`${W}/gestao/filas?responsavel=subprefeitura&status=pendente_envio`);
    await page.getByText(/problemas? ·/).waitFor();
    await page.locator('tbody button[aria-expanded]').first().click();
    await page.getByLabel('Mudar status').selectOption('enviada');
    await page.getByRole('button', { name: 'Salvar status' }).click();
    await page.getByText('Esta ocorrência é de outro órgão').waitFor();
    console.log(tema, 'João (Sabesp) na fila da subprefeitura: 403, status na tela:', await page.locator('tbody tr').first().locator('td').nth(3).textContent());
    await shot(page, `8-${t}-outro-orgao`);
    await ctx.close();

    // 8b. Cidadão: "Marcar no mapa" na captura do reporte
    ({ ctx, page } = await novo(browser, tema, MOB));
    await page.goto(`${W}/reportar`);
    await page.getByRole('button', { name: 'Marcar no mapa' }).click();
    await page.locator('.leaflet-marker-icon').first().waitFor({ timeout: 15000 });
    await page.locator('.qr-mapa').click({ position: { x: 150, y: 120 } });
    await page.getByText('Local marcado no mapa').waitFor();
    await shot(page, `8-${t}-cidadao-ajustar-no-mapa`);
    console.log(tema, 'cidadão marcou o local no mapa: ok');
    await ctx.close();

    // 9. Celular (390): visão geral, filas aberta e sessão expirada
    ({ ctx, page } = await novo(browser, tema, MOB));
    await page.goto(`${W}/gestao/entrar`);
    await entrar(page);
    await page.waitForURL((u) => u.pathname === '/gestao');
    await grafico(page);
    await shot(page, `9-${t}-mob-visao-geral`);
    await page.getByRole('navigation', { name: 'Seções do console' }).last().getByRole('link', { name: 'Filas' }).click();
    await page.getByText(/problemas? ·/).waitFor();
    await page.locator('tbody button[aria-expanded]').first().click();
    await shot(page, `9-${t}-mob-filas`);
    await page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('quem-resolve:gestor')); s.token = 'expirado'; sessionStorage.setItem('quem-resolve:gestor', JSON.stringify(s)); });
    await page.reload();
    await page.getByText('Sua sessão terminou').waitFor();
    console.log(tema, 'sessão expirada → Entrar com volta:', decodeURIComponent(new URL(page.url()).searchParams.get('volta')));
    await shot(page, `9-${t}-mob-sessao-expirou`);
    await ctx.close();
  }
  console.log(erros.length ? `ERROS:\n${erros.join('\n')}` : 'sem erros de página');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

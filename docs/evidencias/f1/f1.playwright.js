const { chromium } = require('playwright');
const OUT = process.argv[2];
// Uso: node f1.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]  (API em :8000 e front em :3000)
const FOTO = require('path').join(__dirname, '../../../api/tests/fixtures/rua_rdd2022.jpg');
const temas = (process.argv[3] || 'claro,escuro,alto-contraste').split(',');
const erros = [];
async function novo(browser, tema, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, locale: 'pt-BR',
    geolocation: opts.semLocal ? undefined : { latitude: -23.5617, longitude: -46.6560 }, permissions: opts.semLocal ? [] : ['geolocation'] });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [] })); }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`${tema} console: ${m.text()}`); });
  if (opts.apiFora) await page.route('http://localhost:8000/**', (r) => r.abort());
  return { ctx, page };
}
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true });
(async () => {
  const browser = await chromium.launch();
  const mob = { width: 390, height: 844 };
  for (const tema of temas) {
    const t = tema.slice(0, 2);
    // 1. Caminho feliz com foto
    let { ctx, page } = await novo(browser, tema, mob);
    await page.goto('http://localhost:3000/reportar');
    await page.getByLabel('Descreva o problema').fill('Tem um buraco grande no asfalto perto do ponto de ônibus');
    await page.locator('input[type=file]:not([capture])').setInputFiles(FOTO);
    await page.getByAltText('Prévia da foto escolhida').waitFor();
    await page.getByRole('button', { name: 'Usar minha localização' }).click();
    await page.getByText('Localização pega').waitFor();
    await shot(page, `1-${t}-captura`);
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByRole('heading', { name: /Isso parece ser/ }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    await shot(page, `1-${t}-resultado`);
    await page.getByRole('button', { name: 'Está certo, continuar' }).click();
    await page.getByText('Confira antes de enviar').waitFor();
    await shot(page, `1-${t}-confirmacao`);
    await page.getByRole('button', { name: 'Confirmar e gerar solicitação' }).click();
    await page.getByText('Solicitação gerada').waitFor();
    await page.getByRole('button', { name: 'Sim' }).click();
    await page.getByText('Obrigado pela resposta').waitFor();
    await shot(page, `1-${t}-protocolo`);
    await page.goBack(); await page.waitForTimeout(500);
    console.log(tema, 'voltar depois do protocolo ->', page.url());
    await page.goto('http://localhost:3000/meus-reportes');
    await page.getByText('Buraco na via').first().waitFor();
    await page.waitForTimeout(800);
    await shot(page, `5-${t}-meus-reportes`);
    await ctx.close();

    // 2. "Não é isso" (texto vago, confiança baixa)
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto('http://localhost:3000/reportar');
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.waitForTimeout(300);
    await shot(page, `2-${t}-validacao`);
    await page.getByLabel('Descreva o problema').fill('Tem uma coisa estranha aqui na rua faz dias');
    await page.getByLabel('Rua ou ponto de referência').fill('Rua Augusta, 900');
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByText(/Escolha o problema|Qual destes|Não tenho certeza/).first().waitFor({ timeout: 20000 });
    await shot(page, `2-${t}-nao-e-isso`);
    await page.getByLabel(/procure/i).fill('lixo');
    await page.getByText('Lixo acumulado em via pública').click();
    await page.waitForTimeout(300);
    await shot(page, `2-${t}-escolhido`);
    await page.goBack(); await page.waitForTimeout(300);
    console.log(tema, 'voltar do resultado ->', page.url(), await page.getByLabel('Descreva o problema').inputValue());
    await ctx.close();

    // 3. Emergência
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto('http://localhost:3000/reportar');
    await page.getByLabel('Descreva o problema').fill('A casa do vizinho está pegando fogo agora');
    await page.getByRole('button', { name: 'Usar minha localização' }).click();
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByRole('heading', { name: /emergência|ajuda especializada/ }).waitFor({ timeout: 20000 });
    await shot(page, `3-${t}-emergencia`);
    console.log(tema, 'rascunho guardado na emergência?', await page.evaluate(() => sessionStorage.getItem('quem-resolve:rascunho')));
    await ctx.close();

    // 3b. Risco nível 3
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto('http://localhost:3000/reportar');
    await page.getByLabel('Descreva o problema').fill('Tem um fio soltando faísca na frente de casa');
    await page.getByRole('button', { name: 'Usar minha localização' }).click();
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByText(/pode haver risco/).first().waitFor({ timeout: 20000 });
    await shot(page, `3-${t}-risco`);
    await ctx.close();

    // 4. API desligada
    ({ ctx, page } = await novo(browser, tema, mob, { apiFora: true, semLocal: true }));
    await page.goto('http://localhost:3000/reportar');
    await page.getByLabel('Descreva o problema').fill('O poste da minha rua está apagado');
    await page.getByRole('button', { name: 'Usar minha localização' }).click();
    await page.waitForTimeout(800);
    await page.getByLabel('Rua ou ponto de referência').fill('Rua Vergueiro, 1000');
    await shot(page, `4-${t}-sem-local`);
    await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
    await page.getByText('Não consegui analisar agora').waitFor({ timeout: 20000 });
    await shot(page, `4-${t}-api-fora`);
    await page.getByText('Iluminação pública').first().click();
    await page.getByRole('button', { name: /continuar/i }).first().click();
    await page.getByRole('button', { name: 'Confirmar e gerar solicitação' }).click();
    await page.getByText('Não consegui gerar a solicitação').waitFor();
    await shot(page, `4-${t}-envio-falhou`);
    await ctx.close();
  }
  // Desktop
  let { ctx, page } = await novo(browser, 'claro', { width: 1280, height: 900 });
  await page.goto('http://localhost:3000/reportar');
  await page.getByLabel('Descreva o problema').fill('Tem um buraco grande no asfalto perto do ponto de ônibus');
  await page.locator('input[type=file]:not([capture])').setInputFiles(FOTO);
  await page.getByAltText('Prévia da foto escolhida').waitFor();
  await page.getByRole('button', { name: 'Usar minha localização' }).click();
  await page.getByRole('button', { name: 'Descobrir quem resolve' }).click();
  await page.getByRole('heading', { name: /Isso parece ser/ }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  await shot(page, `6-desktop-resultado`);
  await ctx.close();
  await browser.close();
  console.log('ERROS:', erros.length ? erros.join('\n') : 'nenhum');
})().catch((e) => { console.error('FALHOU', e.message); process.exit(1); });

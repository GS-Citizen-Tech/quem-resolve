// Uso: node f2.playwright.js <pasta-de-saida> [claro,escuro,alto-contraste]  (API em :8000 e front em :3000)
const { chromium } = require('playwright');
const OUT = process.argv[2];
const temas = (process.argv[3] || 'claro,escuro,alto-contraste').split(',');
const erros = [];
const W = 'http://localhost:3000', A = 'http://localhost:8000';
async function novo(browser, tema, vp, opts = {}) {
  // Só o teste do OuviAí deixa os avisos ligados (senão o alerta do teste aparece em todos os prints).
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, locale: 'pt-BR',
    permissions: opts.semMic ? [] : ['microphone'] });
  await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t.tema, meusReportes: [], conversa: [], avisosSom: t.avisos })); }, { tema, avisos: !!opts.avisos });
  await ctx.route('https://www.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>Google</title>previsão do tempo' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`${tema}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|403|Failed to load resource/.test(m.text())) erros.push(`${tema} console: ${m.text()}`); });
  if (opts.apiFora) await page.route(`${A}/assistente/**`, (r) => r.abort());
  return { ctx, page };
}
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true });
const perguntar = async (page, t) => { await page.getByLabel('Sua pergunta').fill(t); await page.getByRole('button', { name: 'Enviar' }).click(); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const mob = { width: 390, height: 844 };
  for (const tema of temas) {
    const t = tema.slice(0, 2);
    // 1. Chat: vazio, resposta com fonte, sem fonte
    let { ctx, page } = await novo(browser, tema, mob);
    await page.goto(`${W}/assistente`);
    await page.getByText('Experimente perguntar').waitFor();
    await shot(page, `1-${t}-chat-vazio`);
    await page.getByRole('button', { name: 'Tem um fio pendurado na rua, quem eu chamo?' }).click();
    await page.getByText('Fontes').first().waitFor({ timeout: 20000 });
    await page.getByText('(ver trecho)').first().click();
    await perguntar(page, 'Qual o horário do metrô no domingo?');
    await page.getByText(/Não achei isso nas fontes|só respondo/).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Sim' }).last().click();
    await page.getByText('Obrigado pela resposta').waitFor();
    await shot(page, `1-${t}-chat-respostas`);
    await page.reload(); await page.getByText('Fontes').first().waitFor();
    console.log(tema, 'conversa sobrevive ao recarregar: ok');
    await ctx.close();

    // 2. Chat fora do ar
    ({ ctx, page } = await novo(browser, tema, mob, { apiFora: true }));
    await page.goto(`${W}/assistente`);
    await perguntar(page, 'Quem conserta a calçada?');
    await page.getByText('Não enviada').waitFor({ timeout: 20000 });
    await shot(page, `2-${t}-chat-fora-do-ar`);
    await ctx.close();

    // 3. Emergência pelo chat
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto(`${W}/assistente`);
    await perguntar(page, 'A casa do vizinho está pegando fogo');
    await page.getByRole('heading', { name: 'Isso parece uma emergência' }).waitFor({ timeout: 20000 });
    await shot(page, `3-${t}-chat-emergencia`);
    await page.getByRole('button', { name: /voltar para a conversa/ }).click();
    console.log(tema, 'mensagem de emergência guardada?', await page.evaluate(() => JSON.parse(localStorage.getItem('quem-resolve:v1')).conversa.length));
    await ctx.close();

    // 4. Violência doméstica + Sair rápido (Esc)
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto(`${W}/assistente`);
    await perguntar(page, 'Quem conserta buraco na rua?');
    await page.getByText('Fontes').first().waitFor({ timeout: 20000 });
    await perguntar(page, 'Meu marido me bate, o que eu faço?');
    await page.getByRole('button', { name: 'Sair rápido' }).waitFor({ timeout: 20000 });
    await shot(page, `4-${t}-violencia-sair-rapido`);
    await page.keyboard.press('Escape');
    await page.waitForURL(/google\.com/);
    const resto = await ctx.newPage(); await resto.goto(`${W}/`);
    console.log(tema, 'Sair rápido ->', page.url().slice(0, 40), '| conversa depois:', await resto.evaluate(() => JSON.parse(localStorage.getItem('quem-resolve:v1')).conversa.length));
    await ctx.close();

    // 5. Voz (mock): consentimento, gravação, resposta
    ({ ctx, page } = await novo(browser, tema, mob));
    await page.goto(`${W}/`);
    await page.getByRole('link', { name: 'Falar' }).click();
    await page.getByText('Antes de falar').waitFor();
    await shot(page, `5-${t}-voz-consentimento`);
    await page.getByRole('button', { name: 'Entendi, quero falar' }).click();
    await page.getByRole('button', { name: 'Tocar para falar' }).click();
    await page.getByText(/Ouvindo… [1-9]s/).waitFor({ timeout: 10000 });
    await shot(page, `5-${t}-voz-gravando`);
    await page.getByRole('button', { name: 'Parar e enviar' }).click();
    await page.getByText('Respondeu em').first().waitFor({ timeout: 30000 });
    await shot(page, `5-${t}-voz-resposta`);
    await ctx.close();

    // 6. OuviAí: evento de sirene chega com o app aberto
    ({ ctx, page } = await novo(browser, tema, mob, { avisos: true }));
    await page.goto(`${W}/reportar`);
    await page.waitForTimeout(1500);
    await fetch(`${A}/iot/eventos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classe: 'sirene', confianca: 0.91, dispositivo: 'celular-teste' }) });
    await page.getByText('Sirene por perto', { exact: true }).waitFor({ timeout: 12000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/6-${t}-ouviai-alerta.png` });
    await page.getByRole('button', { name: 'Desligar avisos' }).click();
    console.log(tema, 'avisos depois de desligar:', await page.evaluate(() => JSON.parse(localStorage.getItem('quem-resolve:v1')).avisosSom));
    await ctx.close();
  }
  // Microfone negado (navegador sem permissão)
  const b2 = await chromium.launch();
  let { ctx, page } = await novo(b2, 'claro', mob, { semMic: true });
  await page.goto(`${W}/assistente?voz=1`);
  await page.getByRole('button', { name: 'Entendi, quero falar' }).click();
  await page.getByRole('button', { name: 'Tocar para falar' }).click();
  await page.getByText(/microfone não foi liberado|não grava áudio/).waitFor({ timeout: 10000 });
  await shot(page, `5-cl-voz-negado`);
  await ctx.close(); await b2.close();
  // Desktop
  ({ ctx, page } = await novo(browser, 'claro', { width: 1280, height: 900 }));
  await page.goto(`${W}/assistente`);
  await page.getByRole('button', { name: 'Quem conserta a calçada na frente de casa?' }).click();
  await page.getByText('Fontes').first().waitFor({ timeout: 20000 });
  await shot(page, `7-desktop-chat`);
  await ctx.close();
  await browser.close();
  console.log('ERROS:', erros.length ? erros.join('\n') : 'nenhum');
})().catch((e) => { console.error('FALHOU', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });

// Prints da revisão visual (16/11): 3 temas no computador e tema claro no celular.
// Rodar com a API (porta 8000) e o front (porta 3000) ligados: node revisao.playwright.js
const { chromium } = require('playwright');
const OUT = __dirname, URL = 'http://localhost:3000';
const TEMAS = [['cl', 'claro'], ['es', 'escuro'], ['al', 'alto-contraste']];
const CONSOLE = [['visao', '/gestao'], ['filas', '/gestao/filas'], ['mapa', '/gestao/mapa'], ['frota', '/gestao/frota'], ['qualidade', '/gestao/qualidade']];
(async () => {
  const b = await chromium.launch();
  const novo = async (vp, tema) => {
    const ctx = await b.newContext({ viewport: vp, locale: 'pt-BR', geolocation: { latitude: -23.5557, longitude: -46.6622 }, permissions: ['geolocation'] });
    await ctx.addInitScript((t) => { if (!localStorage.getItem('quem-resolve:v1')) localStorage.setItem('quem-resolve:v1', JSON.stringify({ tema: t, meusReportes: [], conversa: [], avisosSom: false })); }, tema);
    return ctx;
  };
  const cidadao = async (p, pre, cheia) => {
    const foto = async (n) => p.screenshot({ path: `${OUT}/${pre}-${n}.png`, fullPage: cheia });
    await p.goto(URL + '/'); await p.waitForTimeout(1500); await foto('1-inicio');
    await p.goto(URL + '/reportar?texto=' + encodeURIComponent('Tem um buraco na rua')); await p.waitForTimeout(2500); await foto('2-reportar');
    await p.getByRole('button', { name: /Descobrir quem resolve/ }).click(); await p.waitForTimeout(4000); await foto('3-resultado');
    await p.goto(URL + '/assistente'); await p.waitForTimeout(1500); await foto('4-tirar-duvida');
  };
  const entrar = async (p) => { await p.goto(URL + '/gestao/entrar'); await p.getByRole('button', { name: /Marina/ }).click(); await p.keyboard.press('Enter'); await p.waitForURL(/\/gestao$/); };
  for (const [sigla, tema] of TEMAS) {
    const ctx = await novo({ width: 1440, height: 900 }, tema); const p = await ctx.newPage();
    await cidadao(p, `pc-${sigla}-cidadao`, true);
    await entrar(p);
    for (const [n, u] of CONSOLE) { await p.goto(URL + u); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/pc-${sigla}-console-${n}.png`, fullPage: true }); }
    await ctx.close();
  }
  const ctx = await novo({ width: 390, height: 844 }, 'claro'); const p = await ctx.newPage();
  await cidadao(p, 'cel-cl-cidadao', false);
  await entrar(p);
  for (const [n, u] of CONSOLE.slice(0, 2)) { await p.goto(URL + u); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/cel-cl-console-${n}.png` }); }
  await b.close();
})();

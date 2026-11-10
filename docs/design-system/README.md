Quem Resolve? diz ao cidadão de São Paulo **quem resolve** um problema de rua, **por qual canal** e **o que fazer**, e entrega ao servidor público um console com tudo priorizado. A marca é confiável, acolhedora, direta e cidadã: um produto independente, que nunca imita a Prefeitura, o SP156, a Enel, a Sabesp, a CET ou qualquer órgão real.

O estilo é **vidro fosco sobre uma rua de São Paulo no fim de tarde**, com uma única cor de destaque verde-floresta. O vidro foi ajustado para a acessibilidade vir antes do efeito: todo texto passa de 4.5:1 mesmo se a foto atrás for totalmente preta ou totalmente branca.

## Voz e texto

- Português do Brasil, frases curtas, verbo primeiro nos botões: "Confirmar e gerar solicitação", "Não é isso", "Ligar 193".
- Fale com o cidadão por "você"; a interface nunca diz "eu". Respostas da IA começam com a hipótese: "Isso parece ser **Buraco na via**".
- Diga quem resolve pelo nome que a pessoa conhece ("Prefeitura (subprefeitura)", "Enel") e o canal com número ("SP156 · 156").
- Sem emoji, sem exclamação em mensagens do sistema, sem jargão de governo ("protocolar demanda" vira "gerar solicitação").
- Erros dizem o que fazer: "Conte um pouco mais: onde fica e o tamanho."
- Sentença em caixa normal em títulos e botões. O nome do app sempre com o ponto de interrogação.

## Cor

Três temas: `light` (Claro, padrão), `dark` (Escuro) e `alto-contraste`. Neutros quentes de areia e verde-quase-preto; **uma só cor de destaque**, `accent`, para item ativo, barras do gráfico e ícones positivos. O resto é neutro.

- Texto: `ink` para conteúdo, `ink-muted` para rótulos. Ambos sobre `glass`, `glass-card`, `surface-solid` e `surface-raised`.
- Marca: `brand` (#294b39) com `on-brand` no botão primário e no quadrado do logo.
- Semânticas, sempre com **ícone e palavra**: `ok` (check), `warn` (triângulo), `danger` (octógono / círculo de alerta), `info` (i). Texto da cor sobre o `*-soft` correspondente.
- `emergency` só no botão Ligar 193, sólido, com `on-emergency`.
- `focus-ring` sólido de 3px com 2px de folga, em todo controle. Verde escuro no claro, amarelo-claro no escuro, amarelo puro no alto contraste.
- `ok` e `danger` têm luminosidade parecida: por isso a regra do ícone + palavra é obrigatória, nunca opcional.

## Material de vidro

A pilha é sempre: **foto → `scrim` → `glass` → `glass-card`**.

| Camada | Claro | Escuro | Alto contraste |
| --- | --- | --- | --- |
| `scrim` (véu sobre a foto) | #ece6da a 45% | #110f0d a 50% | preto sólido, sem foto |
| `glass` (painéis com texto) | branco a 64% | #232622 a 70% | preto sólido + borda branca 2px |
| `glass-card` (cartões) | branco a 55% | #2d302b a 70% | preto sólido + borda branca 2px |
| desfoque / saturação | `glass-blur` 22px · `glass-saturate` 1.2 | igual | desligado |
| filete de luz | `glass-edge` 1px em cima | igual | — |
| sombra | `shadow-glass` 0 20px 52px -25px | mais escura | nenhuma |

**Onde o vidro foi ajustado para o contraste:** a referência usa 30% de opacidade; aqui `glass` vai a 64% e ganhou o `scrim` por baixo. Pior caso medido (foto toda preta no claro, toda branca no escuro): `ink` 9.3:1, `ink-muted` 6.1:1, `accent` 4.8:1, `ok` 5.0:1, `warn` 4.7:1, `danger` 4.7:1, `info` 5.2:1. O `accent` foi escurecido de #326b54 para #285a44 porque o original dava 4.4:1. Campos de texto são sólidos (`surface-raised`): o que a pessoa digita nunca fica sobre transparência.

Versão sólida: `surface-solid` substitui o vidro quando o sistema pede **transparência reduzida**, quando o navegador não tem `backdrop-filter` e em telas pesadas (mapa, filas longas), que usam o fundo sem foto: gradiente de `bg` para `bg-2`.

## Fundo

Foto de uma rua arborizada de São Paulo no fim de tarde (calçada, árvores, prédios ao fundo, fiação), suave, sem pessoas identificáveis e sem placas de órgãos. `assets/Fundos/sp-fim-de-tarde.svg` é a ilustração-guia usada nas prévias; troque pela foto final em WebP de ~1600px. O alto contraste remove a foto.

## Tipografia

**Atkinson Hyperlegible Next** em tudo (Google Fonts, pesos 400–700), feita para baixa visão: letras ambíguas (I, l, 1; O, 0) são distintas, o que ajuda a Dona Cida e também a ler protocolos. Ela combina com o vidro porque tem desenho aberto e calmo; nos números grandes use peso 500 com letter-spacing negativo, como na referência, e `font-variant-numeric: tabular-nums`. Não foi preciso uma segunda família para títulos: a hierarquia vem de tamanho e peso. **Atkinson Hyperlegible Mono** só para protocolos.

- App do cidadão: `display` 36px, `title` 26px, `heading` 20px, `body-lg` 18px, `body` 16px, `label` 17px/600. **Nada abaixo de 16px.**
- Console: `kpi` 36px/500, `console-title` 26px, `console-heading` 15px/600, `console-body` 14px, `caption` 12px. **12px é o piso**, só em rótulos secundários do console.

## Forma, espaço e toque

- Raios: `radius-chip` 9px (chips, selos), `radius-control` 14px (botões e campos), `radius-card` 17px, `radius-bar` 20px (topo), `radius-panel` 27px (painel principal), `radius-pill` para dock e trilho.
- Espaços em múltiplos de 4: `space-4` entre cartões, `space-5` dentro do cartão, `space-8` dentro do painel no desktop, `space-6` no celular.
- Alvo de toque `touch-target` 48px no app do cidadão; `control-console` 36px só no console (mouse); `emergency-height` 64px.

## Navegação

Barra do topo de vidro com o logo à esquerda. No desktop: trilho vertical de ícones redondos à esquerda e dock em pílula flutuando na base do painel. No celular, o dock é a navegação principal, com rótulo sempre visível. Item ativo: `rail-active` + `shadow-float` (muda forma, não só cor).

## Movimento

Painéis entram com leve subida + desfoque saindo, 0,5s, `cubic-bezier(.2,.7,.2,1)`, em cascata de 70ms (classe `qr-enter` com `--i`). Com `prefers-reduced-motion: reduce`, nada se mexe.

## Iconografia

**Lucide**, traço 1.75 (2.25 dentro de selos e no botão de emergência), 20px no texto, 24px no botão de emergência. Ícone decorativo leva `aria-hidden`; botão só de ícone leva `aria-label`. Ícones fixos: `circle-check` ok, `triangle-alert` atenção, `octagon-alert` perigo, `info` informação, `circle-help` confiança baixa, `phone` emergência, `mic` voz, `camera` reportar.

## Acessibilidade (regras que não quebram)

- WCAG 2.1 AA medido sobre o vidro em cima da foto (tabela acima).
- Cor nunca sozinha: ok, atenção e perigo sempre com ícone e texto.
- Alto contraste (`data-theme="alto-contraste"`): sem vidro nem foto, fundo preto, texto branco, bordas brancas de 2px, todo texto ≥ 7:1.
- Transparência reduzida → `surface-solid`. Movimento reduzido → sem animação.
- Foco visível em todos os controles (`focus-ring`).
- Botão "Ligar 193" sólido, grande e de alto contraste em todos os temas.
- Botão de ouvir a resposta em voz alta e entrada por voz no app do cidadão.

## Código: tokens para Tailwind v4 + shadcn/ui

Cole em `app/globals.css`. Variáveis shadcn (`--background`, `--primary`…) mais as do projeto (`--color-glass`, `--color-ok`, `--color-destaque`, `--color-emergency`…), utilitários `glass` e `glass-card`, variante `hc:` para alto contraste. Tema escuro: classe `dark` no `<html>`; alto contraste: `data-theme="alto-contraste"`. Carregue a fonte com `next/font/google` (`Atkinson_Hyperlegible_Next`). No Plotly, use `marker.color` = `var(--chart-1)` resolvido e fundos transparentes.

```css
@import "tailwindcss";
/* Quem Resolve? · tokens para Tailwind v4 + shadcn/ui. Tema: <html class="dark"> ou <html data-theme="alto-contraste">. */
:root {
  --background: #d6cebf;
  --foreground: #1f2622;
  --card: #ffffff8c;
  --card-foreground: #1f2622;
  --popover: #fffdf8;
  --popover-foreground: #1f2622;
  --primary: #294b39;
  --primary-foreground: #ffffff;
  --secondary: #ffffffd9;
  --secondary-foreground: #1f2622;
  --muted: #f3efe7;
  --muted-foreground: #3a443d;
  --accent: #d5e6d6cc;
  --accent-foreground: #1f2622;
  --destructive: #9b2620;
  --destructive-foreground: #f6dcd7;
  --border: #24352b29;
  --input: #5c665f;
  --ring: #123a29;
  --chart-1: #285a44;
  --chart-2: #7d877f;
  --sidebar: #ffffffa3;
  --sidebar-foreground: #1f2622;
  --sidebar-primary: #294b39;
  --sidebar-primary-foreground: #ffffff;
  --qr-bg-2: #c9bba5;
  --qr-scrim: #ece6da73;
  --qr-glass: #ffffffa3;
  --qr-glass-card: #ffffff8c;
  --qr-glass-edge: #ffffffb3;
  --qr-surface-solid: #f3efe7;
  --qr-surface-raised: #fffdf8;
  --qr-ink: #1f2622;
  --qr-ink-muted: #3a443d;
  --qr-line-strong: #5c665f;
  --qr-brand-hover: #1f3b2c;
  --qr-destaque: #285a44;
  --qr-destaque-soft: #d5e6d6cc;
  --qr-rail-active: #ffffffd9;
  --qr-on-rail-active: #1f2622;
  --qr-ok: #235740;
  --qr-ok-soft: #d3e7d6;
  --qr-warn: #6e4c12;
  --qr-warn-soft: #f3e3c2;
  --qr-danger: #9b2620;
  --qr-danger-soft: #f6dcd7;
  --qr-info: #1d4f75;
  --qr-info-soft: #d9e6f1;
  --qr-emergency: #a51d16;
  --qr-on-emergency: #ffffff;
  --qr-focus-ring: #123a29;
}
.dark {
  --background: #232622;
  --foreground: #f4f4ed;
  --card: #2d302bb3;
  --card-foreground: #f4f4ed;
  --popover: #2a2d28;
  --popover-foreground: #f4f4ed;
  --primary: #e2eee0;
  --primary-foreground: #183725;
  --secondary: #e2eee02e;
  --secondary-foreground: #f4f4ed;
  --muted: #1d201c;
  --muted-foreground: #d3cdc3;
  --accent: #2c5a42cc;
  --accent-foreground: #f4f4ed;
  --destructive: #ffaea4;
  --destructive-foreground: #4d2320;
  --border: #e1eddf26;
  --input: #9aa69c;
  --ring: #ffe08a;
  --chart-1: #91d5b0;
  --chart-2: #7e897f;
  --sidebar: #232622b3;
  --sidebar-foreground: #f4f4ed;
  --sidebar-primary: #e2eee0;
  --sidebar-primary-foreground: #183725;
  --qr-bg-2: #2f332c;
  --qr-scrim: #110f0d80;
  --qr-glass: #232622b3;
  --qr-glass-card: #2d302bb3;
  --qr-glass-edge: #ffffff2e;
  --qr-surface-solid: #1d201c;
  --qr-surface-raised: #2a2d28;
  --qr-ink: #f4f4ed;
  --qr-ink-muted: #d3cdc3;
  --qr-line-strong: #9aa69c;
  --qr-brand-hover: #cfe3cc;
  --qr-destaque: #91d5b0;
  --qr-destaque-soft: #2c5a42cc;
  --qr-rail-active: #e2eee02e;
  --qr-on-rail-active: #f4f4ed;
  --qr-ok: #9be0bb;
  --qr-ok-soft: #1d3d2c;
  --qr-warn: #ecc983;
  --qr-warn-soft: #46351a;
  --qr-danger: #ffaea4;
  --qr-danger-soft: #4d2320;
  --qr-info: #a9d3f5;
  --qr-info-soft: #1c3347;
  --qr-emergency: #c4271e;
  --qr-on-emergency: #ffffff;
  --qr-focus-ring: #ffe08a;
}
[data-theme="alto-contraste"] {
  --background: #000000;
  --foreground: #ffffff;
  --card: #000000;
  --card-foreground: #ffffff;
  --popover: #000000;
  --popover-foreground: #ffffff;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #ffffff;
  --secondary-foreground: #000000;
  --muted: #000000;
  --muted-foreground: #ffffff;
  --accent: #000000;
  --accent-foreground: #ffffff;
  --destructive: #ff9a8f;
  --destructive-foreground: #000000;
  --border: #ffffff99;
  --input: #ffffff;
  --ring: #ffff00;
  --chart-1: #7dffbe;
  --chart-2: #ffffff;
  --sidebar: #000000;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #000000;
  --qr-bg-2: #000000;
  --qr-scrim: #000000;
  --qr-glass: #000000;
  --qr-glass-card: #000000;
  --qr-glass-edge: #ffffff;
  --qr-surface-solid: #000000;
  --qr-surface-raised: #000000;
  --qr-ink: #ffffff;
  --qr-ink-muted: #ffffff;
  --qr-line-strong: #ffffff;
  --qr-brand-hover: #d9d9d9;
  --qr-destaque: #7dffbe;
  --qr-destaque-soft: #000000;
  --qr-rail-active: #ffffff;
  --qr-on-rail-active: #000000;
  --qr-ok: #7dffbe;
  --qr-ok-soft: #000000;
  --qr-warn: #ffd75e;
  --qr-warn-soft: #000000;
  --qr-danger: #ff9a8f;
  --qr-danger-soft: #000000;
  --qr-info: #9fd4ff;
  --qr-info-soft: #000000;
  --qr-emergency: #a00014;
  --qr-on-emergency: #ffffff;
  --qr-focus-ring: #ffff00;
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-bg-2: var(--qr-bg-2);
  --color-scrim: var(--qr-scrim);
  --color-glass: var(--qr-glass);
  --color-glass-card: var(--qr-glass-card);
  --color-glass-edge: var(--qr-glass-edge);
  --color-surface-solid: var(--qr-surface-solid);
  --color-surface-raised: var(--qr-surface-raised);
  --color-ink: var(--qr-ink);
  --color-ink-muted: var(--qr-ink-muted);
  --color-line-strong: var(--qr-line-strong);
  --color-brand-hover: var(--qr-brand-hover);
  --color-destaque: var(--qr-destaque);
  --color-destaque-soft: var(--qr-destaque-soft);
  --color-rail-active: var(--qr-rail-active);
  --color-on-rail-active: var(--qr-on-rail-active);
  --color-ok: var(--qr-ok);
  --color-ok-soft: var(--qr-ok-soft);
  --color-warn: var(--qr-warn);
  --color-warn-soft: var(--qr-warn-soft);
  --color-danger: var(--qr-danger);
  --color-danger-soft: var(--qr-danger-soft);
  --color-info: var(--qr-info);
  --color-info-soft: var(--qr-info-soft);
  --color-emergency: var(--qr-emergency);
  --color-on-emergency: var(--qr-on-emergency);
  --color-focus-ring: var(--qr-focus-ring);
  --font-sans: "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-mono: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
  --radius: 14px;
  --radius-chip: 9px;
  --radius-control: 14px;
  --radius-card: 17px;
  --radius-bar: 20px;
  --radius-panel: 27px;
  --radius-pill: 999px;
  --spacing: 4px; /* p-4 = 16px, p-5 = 20px, p-8 = 32px, p-12 = 48px */
  --shadow-glass: 0 20px 52px -25px #17291b48;
  --shadow-card: 0 8px 22px -20px #14251c44;
  --blur-glass: 22px;
  --ease-entrada: cubic-bezier(.2,.7,.2,1);
  --animate-entrada: qr-enter .5s var(--ease-entrada) both;
  @keyframes qr-enter { from { opacity: 0; transform: translateY(10px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
}

@custom-variant dark (&:where(.dark, .dark *));
@custom-variant hc (&:where([data-theme="alto-contraste"], [data-theme="alto-contraste"] *));

@utility glass {
  background: var(--qr-glass);
  backdrop-filter: blur(var(--blur-glass)) saturate(1.2);
  box-shadow: inset 0 1px 0 var(--qr-glass-edge), inset 0 0 0 1px var(--border), var(--shadow-glass);
  @media (prefers-reduced-transparency: reduce) { background: var(--qr-surface-solid); backdrop-filter: none; }
  [data-theme="alto-contraste"] & { backdrop-filter: none; box-shadow: none; border: 2px solid var(--qr-line-strong); }
}
@utility glass-card {
  background: var(--qr-glass-card);
  box-shadow: inset 0 1px 0 var(--qr-glass-edge), var(--shadow-card);
  @media (prefers-reduced-transparency: reduce) { background: var(--qr-surface-solid); }
  [data-theme="alto-contraste"] & { box-shadow: none; border: 2px solid var(--qr-line-strong); }
}
@layer base {
  :focus-visible { outline: 3px solid var(--ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
}
```

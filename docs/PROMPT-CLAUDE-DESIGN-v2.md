# Prompt para o Claude Design (v2: só identidade visual, estilo vidro)

> 07/11/2026 · Junta o `PROMPT-CLAUDE-DESIGN.md` com o estilo do componente "Adjustable Glass Dashboard" que o Ian gostou.
> Copie tudo abaixo da linha e cole no Claude Design. Não precisa colar o código do componente: o estilo já está descrito aqui.

---

Quero criar **somente a identidade visual** de um app chamado **Quem Resolve?**. Ainda não é para desenhar o produto inteiro: quero ver como a marca e o estilo ficam, aplicados em duas telas de amostra. É um projeto acadêmico (FIAP, Global Solution 2026, desafio CitizenTech) que compete com outros grupos, então o visual precisa ser marcante, sem perder clareza e acessibilidade.

## O produto, em 4 linhas

Em São Paulo, quem vê um problema na rua (buraco, fio pendurado, lixo acumulado, bueiro entupido) não sabe a quem recorrer: Prefeitura, subprefeitura, Enel, Sabesp, CET ou operadora. No **Quem Resolve?**, o cidadão tira uma foto ou descreve o problema (por texto ou voz), e a IA diz **quem resolve, por qual canal e o que fazer**. Há também um **console para servidores públicos**, com mapa, filas e gráficos, onde chegam os reportes dos cidadãos e as detecções de câmeras em ônibus.

Públicos: **Dona Cida, 64 anos** (pouca familiaridade digital, precisa de texto grande e voz), **Rafael, 29 anos** (quer rapidez) e **Marina, 41 anos** (servidora, quer tudo priorizado).

Personalidade: confiável, acolhedora, direta e cidadã. **Não** pode parecer site burocrático de governo nem lembrar a identidade da Prefeitura, do SP156 ou de qualquer órgão real. É um produto independente.

## O estilo que eu quero (referência)

Gostei muito de um dashboard em **glassmorphism** e quero essa linguagem visual adaptada ao nosso tema:

- **Painéis de vidro fosco** flutuando sobre uma **foto de fundo** em tela cheia: desfoque do fundo (~22 px), saturação levemente aumentada (~1.2), opacidade do vidro ~30%, um filete de luz na borda superior (borda interna clara de 1 px) e sombra longa e suave por baixo.
- **Cantos bem arredondados:** barra do topo ~20 px, painel principal ~27 px, cartões ~17 px, chips e botões ~9 px.
- **Navegação:** barra superior de vidro com logo à esquerda; no desktop, um **trilho vertical** de ícones redondos à esquerda e um **dock flutuante** em forma de pílula na parte de baixo do painel; no celular, o dock vira a navegação principal.
- **Tipografia minimalista:** pesos médios (500) nos números grandes, letter-spacing levemente negativo nos títulos, números tabulares, rótulos secundários em tom apagado.
- **Uma única cor de destaque** para estado ativo, linhas do gráfico e ícones positivos; o resto em neutros.
- **Paleta quente de referência:** fundo areia `#d6cebf`, texto quase preto esverdeado `#242b27`, destaque verde-floresta `#326b54` (no escuro, `#91d5b0`), marca `#294b39`, pendente em âmbar `#805b20`. Pode partir dela ou propor outra.
- **Tema claro e escuro** com a mesma linguagem.
- **Movimento sutil:** os painéis entram com leve subida + desfoque saindo (~0,5 s, em cascata), **desligado** quando o usuário pede movimento reduzido.
- Ícones de traço fino, estilo **Lucide**.

Para combinar com o nosso tema, a foto de fundo deve ser **uma rua ou paisagem urbana de São Paulo** (calçada, árvores, prédios, luz de fim de tarde), suave o bastante para não brigar com o conteúdo. Sugira também uma versão sem foto (gradiente) para telas mais pesadas.

## Regras que não podem quebrar (fazem parte da nota)

O vidro é bonito, mas reduz contraste. Ajuste o estilo para cumprir:

- **WCAG 2.1 AA:** texto com contraste mínimo de 4.5:1 **medido sobre o vidro em cima da foto**. Se precisar, aumente a opacidade dos painéis que têm texto.
- **Tamanhos:** o app do cidadão usa texto de no mínimo 16 px e **alvos de toque de 48 px**. Os tamanhos pequenos da referência (9 a 12 px) só podem aparecer em rótulos secundários do console, e nunca abaixo de 12 px.
- **Cor nunca sozinha:** ok, atenção e perigo vêm sempre com **ícone e texto**.
- **Modo alto contraste:** desliga o vidro e a foto, deixa fundo preto sólido, texto branco e bordas claras.
- **Transparência reduzida:** se o sistema pedir, o vidro vira superfície sólida.
- **Foco visível** em todos os controles.
- **Emergência não é vidro:** o botão "Ligar 193" é sólido, grande e de alto contraste.
- Tudo em **português do Brasil**. Vai ser feito em **Next.js + Tailwind CSS** (shadcn/ui é bem-vindo) e os gráficos em **Plotly**.

## O que eu quero receber

1. **2 ou 3 direções** de identidade antes de detalhar (ex.: verde-floresta quente, azul-petróleo urbano, terracota). Para cada uma, mostre o logo, a paleta e uma prévia pequena.
2. Depois que eu escolher, a **folha de identidade**:
   - **Logo** simples (funciona como ícone de app, pequeno e em preto e branco).
   - **Paleta** completa em hex, com as versões **claro, escuro e alto contraste**: neutros, cor de destaque e as semânticas (ok, atenção, perigo, informação).
   - **Tipografia:** sugiro Atkinson Hyperlegible (feita para baixa visão) no app do cidadão. Avalie se ela combina com o estilo ou se é melhor outra para títulos e números.
   - **Material de vidro:** os valores de blur, opacidade, saturação, borda e sombra, mais a versão sólida.
   - **Amostras de componentes no estilo:** botão primário, secundário e de emergência; selo de confiança (alta, média, baixa, com ícone e texto); cartão de vidro; campo de texto com rótulo e erro; dock de navegação.
3. **Duas telas de amostra**, só para ver a identidade aplicada (não precisam ser finais):
   - **Celular · Resultado do cidadão:** "Isso parece ser **Buraco na via**", selo "Confiança alta (92%)", bloco "Quem resolve: Prefeitura (subprefeitura) · Canal: SP156 · 156", botões "Confirmar e gerar solicitação" e "Não é isso".
   - **Desktop · Console da gestão:** topo de vidro com logo e "Marina · Subprefeitura Itaquera", 3 indicadores (120 ocorrências no mês, 22% fora da competência da Prefeitura, 12% corrigidas pelo cidadão), um gráfico de barras por categoria com 2 filtros acima, e o trilho e o dock de navegação (Visão geral, Mapa, Filas, Frota, Qualidade da IA).
4. No final, os **tokens** (cores dos 3 temas, fontes, raios, espaçamentos, valores do vidro) em formato de **variáveis CSS para Tailwind v4** (`--color-*`, compatível com shadcn), para eu colar direto no código.

Explique rapidamente cada escolha pensando em acessibilidade, principalmente onde o vidro teve que ser ajustado para manter o contraste.

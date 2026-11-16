# Plano · Revisão visual do app (menos cara de IA, mais profissional)

> Versão 1.0 · 16/11/2026 · aprovado pelo Ian e FEITO (pacotes A, B, C e D). Resultado na seção 7. Separado da F4.
> Como foi feito: abri todas as telas (cidadão no celular e no computador, console inteiro, tema claro e escuro) e anotei o que denuncia "feito por IA" ou "protótipo".

## 1. O diagnóstico em uma frase

O app funciona bem e é acessível, mas **explica demais, enfeita demais e repete a mesma caixa de vidro em tudo**. Produto profissional mostra menos coisa, com mais hierarquia. A revisão é quase toda de **tirar**, não de pôr.

## 2. O que encontrei

### 2.1 No app inteiro

| # | Problema | Onde aparece | O que fazer |
|---|---|---|---|
| G1 | **Fundo de desenho genérico** (prédios cinza, bolas verdes). É o sinal mais forte de "template". O design system pedia foto de rua de São Paulo no fim de tarde. | Todas as telas | Cidadão: foto real de rua de SP (uma só, bem tratada, com o scrim). Console: **fundo liso** cor de areia, sem cena. |
| G2 | **Vidro dentro de vidro.** Painel de vidro, com cartão de vidro dentro, com outro cartão dentro, todos com o mesmo canto bem redondo. Tudo tem o mesmo peso e nada chama atenção. | Todas | Uma camada só por tela. Cartão interno vira seção com título e linha fina. Cantos menores no console (12 px) e maiores só no cidadão. |
| G3 | **Texto atrás de vidro transparente no console.** Os indicadores ("128", "17,2%") têm o prédio aparecendo atrás do número. | Visão geral, Frota, Qualidade | Console com superfície sólida. O vidro fica como identidade do app do cidadão. |
| G4 | **Duas navegações ao mesmo tempo** no console: trilho na lateral e barra embaixo. | Console no computador | Computador: só o trilho lateral, com o nome ao lado do ícone. Celular: só a barra de baixo. |
| G5 | **A barra de baixo cobre o conteúdo** (tapa os exemplos da tela inicial e o cartão "Local" do Reportar). | Cidadão no celular | Barra presa no rodapé, com o conteúdo terminando antes dela. |
| G6 | **Quatro botões no topo de toda tela** (sino, claro, escuro, contraste). Parece painel de demonstração. | Todas | Um botão só, "Aparência", que abre as 3 opções. O sino fica (é função real). |
| G7 | **Explicação em todo lugar.** Cada título tem um parágrafo embaixo, cada cartão tem uma legenda. Ex.: "Os números de visão, 'Isso ajudou?' e guardrail contam desde que a API ligou." | Console principalmente | Regra: no máximo **uma** frase de apoio por tela. O resto sai ou vai para um "?" de ajuda. |
| G8 | **Palavra de programador na tela:** mock, API, guardrail, LLM, RAG, p95, FPS, ONNX, "banco · memoria". | Qualidade, Frota | Trocar pela palavra do servidor público (seção 4). O termo técnico fica só na tela de Qualidade, dentro de "Detalhes técnicos". |
| G9 | **Ícone em todo título e em todo selo.** Quando tudo tem ícone, nenhum ajuda. | Todas | Ícone só em botão, navegação e estado (ok, atenção, perigo). Título de seção sem ícone. |
| G10 | **Caixa tracejada nos estados vazios** e na área de envio. É o padrão de todo gerador de tela. | Meus reportes, Qualidade, Frota | Vazio vira uma frase e um botão, sem moldura. |
| G11 | **Controles do navegador sem estilo:** listas suspensas padrão e "Choose File · No file chosen" em inglês. | Filtros do console, Frota | Um componente de seleção e um de arquivo, iguais em todas as telas e em português. |
| G12 | **Separadores "·" e travessões em excesso** ("41 problemas · 83 reportes (reportes do mesmo lugar ficam juntos)"). | Console | Frases curtas ou duas linhas. |
| G13 | **Sem rodapé.** Não diz quem fez, nem privacidade. Produto real tem. | Cidadão | Rodapé discreto: "Projeto acadêmico FIAP", Privacidade (LGPD), Sou servidor público. |

### 2.2 App do cidadão

| # | Problema | O que fazer |
|---|---|---|
| C1 | **Tela inicial centralizada e genérica** no computador: um cartão estreito boiando no meio da tela. | No computador, duas colunas: à esquerda a chamada e a bola; à direita "como funciona" em 3 passos curtos com um exemplo real de resposta. No celular fica como está, mais enxuta. |
| C2 | O anel claro em volta da bola parece efeito de modelo pronto. | Bola sólida com sombra suave; o anel só pulsa quando está ouvindo. |
| C3 | **Resultado com informação empilhada:** foto, legenda da foto, "Isso parece ser", selo de confiança, "Identificado pelo texto", "Por que a IA acha isso?", quem resolve, ouvir, dois botões. A resposta que importa (quem resolve) fica no fim. | Inverter: primeiro **"Quem resolve: Subprefeitura, pelo SP156"** grande. Depois a foto com o que foi visto. Confiança e "por quê" numa linha recolhida "Como a IA chegou nisso". |
| C4 | No Reportar, o microfone aparece de novo, grande, dentro do cartão de texto. | Botão pequeno de microfone dentro do campo, no canto. |
| C5 | Chips de exemplo e perguntas sugeridas com borda grossa escura, pesados. | Borda fina, fundo claro. |
| C6 | "Tirar dúvida": dois botões grandes (Enviar, Falar) embaixo de um campo de uma linha. | Campo de conversa padrão: caixa de texto com enviar e microfone dentro. |

### 2.3 Console do servidor

| # | Problema | O que fazer |
|---|---|---|
| S1 | **Filas é uma "sopa de selos":** cada linha tem 4 pílulas coloridas (prioridade, origem, status, confiança). São 41 linhas, sem página, e o status é igual em quase todas. | Só a prioridade leva cor. Origem vira ícone com texto simples. Confiança vira número. Status só aparece quando é diferente de "Aguardando envio" (ou vira aba no topo: Aguardando, Enviadas, Resolvidas). Linhas mais baixas e 20 por página. |
| S2 | **Gráficos com cara de planilha:** 16 barras iguais, grade, eixo com números, e o cartão da direita com metade vazia. | Categorias: as 8 maiores mais "Outras", barra fina, valor no fim, sem grade nem eixo. Origem: uma barra única dividida em 3 partes com os números. Os dois cartões com a mesma altura. |
| S3 | **Indicadores sem comparação.** "128 ocorrências" não diz se é muito ou pouco. | Cada número com a variação da semana ("+12 esta semana") e o que pede atenção primeiro ("6 de prioridade alta"). |
| S4 | **Frota abre com uma área de envio enorme** e três parágrafos. O que o gestor quer ver (o que os ônibus acharam) fica embaixo. | Mapa e passagens em cima. Envio vira botão "Processar vídeo" que abre um painel. |
| S5 | **Qualidade da IA parece tela de desenvolvedor** ("Módulos: Simulado (mock)"). | Em cima, 4 números em linguagem simples. "Módulos" desce para "Detalhes técnicos", recolhido. |
| S6 | Legenda do mapa com 7 itens em linha. | Duas linhas: "Tamanho = número de reportes" e as 3 cores. As formas ficam na ajuda. |
| S7 | Cabeçalho de cada tela é um cartão grande só com título, frase e filtros. | Título e filtros numa barra única, mais baixa. |

## 3. Como ficaria (resumo visual)

- **Cidadão:** foto real de rua ao fundo, um painel de vidro só, muita folga, uma ação principal por tela. É onde fica a "cara" do produto.
- **Console:** fundo liso, superfícies sólidas brancas/areia com linha fina, trilho lateral com nomes, tabelas densas e gráficos limpos. Ferramenta de trabalho, não vitrine.
- **Cor:** o verde continua sendo o único destaque. Vermelho, amarelo e verde de estado só onde há decisão a tomar.
- **Texto:** frases curtas, sem termo técnico, sem explicar o óbvio.

## 4. Palavras a trocar

| Hoje | Fica |
|---|---|
| Simulado (mock) | Em demonstração |
| Guardrail de segurança | Desvios para emergência |
| Classificação (LLM) | Leitura do texto |
| Assistente (RAG) | Tirar dúvida |
| Latência média · p95 | Tempo de resposta |
| FPS médio (YOLO em ONNX, CPU) | Velocidade da análise |
| banco · Real · memoria | Banco de dados: ligado |
| Com os filtros marcados | (sai) |
| Ocorrências recebidas pelo app e pelos ônibus. Toque numa barra para filtrar por ela. | (sai; a barra ganha dica ao passar o mouse) |

## 5. Ordem de trabalho (pacotes separados)

| Pacote | O que entra | Tamanho | Efeito |
|---|---|---|---|
| **A · Base** | G1 a G6, G9, G10, G11: fundo, superfícies, cantos, navegação, topo, controles | meio dia | Muda a cara de todas as telas de uma vez |
| **B · Console** | S1 a S7 | 1 dia | É o que mais aparece no vídeo |
| **C · Cidadão** | C1 a C6, G13 | meio dia | Tela inicial e resultado |
| **D · Textos** | G7, G8, G12 e a seção 4, em todas as telas | 2 a 3 horas | Tira a "voz de IA" |

Cada pacote termina com prints novos nos 3 temas e no celular, e a regra de acessibilidade continua valendo (contraste, 48 px no cidadão, cor nunca sozinha, sem botão desabilitado).

**Prazo:** a entrega é 19/11 e o vídeo é 18/11, e a F4 (deploy, README, teste com 3 pessoas) ainda não começou. Fazer os 4 pacotes leva uns 2 dias e meio. Minha sugestão: **A e D hoje, B amanhã cedo**, e C só se sobrar tempo, porque o cidadão já está melhor que o console.

## 6. Decisões para o Ian

1. **Console sem vidro e com fundo liso?** Recomendo sim. Isso muda o design system (hoje ele pede vidro em tudo), então eu atualizo o documento dele junto.
2. **Foto de fundo do cidadão:** você me manda uma foto de rua de São Paulo (pode ser sua, de celular), ou eu deixo um fundo liso com degradê suave até você escolher? Daqui eu não consigo baixar foto da internet.
3. **Zero cortado nos números** ("128", "900"): vem da fonte Atkinson, escolhida por acessibilidade. Recomendo manter e dizer isso no README. A outra opção é usar outra fonte só nos números grandes do console.
4. **Quais pacotes e em que ordem**, dado o prazo.

## 7. Resultado (16/11/2026)

Decisões do Ian: console sem vidro e com fundo liso (sim); fundo do cidadão liso por enquanto, a foto ele manda depois; fonte Atkinson mantida; os 4 pacotes.

| Pacote | Feito |
|---|---|
| **A · Base** | Fundo em degradê suave no cidadão e liso no console. Console com superfície sólida, linha fina e cantos menores. Uma navegação por vez (coluna lateral com nomes no computador, barra de baixo no celular). Um botão "Aparência" no lugar dos 3 de tema. Listas suspensas e envio de arquivo com o mesmo estilo e em português. Vazios sem caixa tracejada. Títulos sem ícone. |
| **B · Console** | Visão geral: 4 números com comparação ("32 nos últimos 7 dias", "6 de prioridade alta"), gráfico com as 8 maiores categorias e "Outras", barra única de "Quem viu o problema", bairros com mais problemas. Filas: só a prioridade leva cor, 20 por página com "Mostrar mais". Mapa: título e filtros numa linha, legenda em 4 linhas com nome. Frota: mapa e passagens em cima, envio atrás do botão "Analisar vídeo". Qualidade: 4 números em linguagem simples, fila "Para revisar", "Detalhes técnicos" recolhido. |
| **C · Cidadão** | Início em duas colunas no computador, com "Como funciona" em 3 passos e um exemplo. Bola sólida (o anel só pulsa ouvindo). Resultado começa por "Quem resolve", com "Como a IA chegou nisso" recolhido. Microfone como botão dentro do campo. Chips com borda fina. Tirar dúvida com campo de conversa (enviar e microfone dentro). Rodapé com "Projeto acadêmico · FIAP 2026" e "Sou servidor público". |
| **D · Textos** | Saíram os parágrafos de explicação e as palavras técnicas (tabela da seção 4). Menos "·". |

Foto de fundo: o Ian mandou uma da Av. Paulista em 16/11, aplicada em `web/public/fundos/sp-paulista.webp`. Ficou para depois a página de Privacidade (LGPD) no rodapé, que entra com o README na F4.

Conferido: `npm run build` e `eslint` sem erro. Prints nos 3 temas (computador) e no celular em `docs/evidencias/revisao-visual/` (34 imagens e o script `revisao.playwright.js`).

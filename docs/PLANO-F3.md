# Plano da F3: console da gestão

> Versão **1.0** · 12/11/2026 · Ian · **Aprovado e implementado** (ver seção 9).
> Base: `PLANO-FRONT.md` (3.2 e 12), `EXEMPLOS-FLUXO.md` (jornada da Marina), `CONTRATOS.md` v0.7 (E, F, I, M), design system (`TelaConsole.md`, `Navegacao.md`) e o que ficou pronto na F1 e na F2.

## 1. Objetivo

A Marina, servidora da subprefeitura, entra com login e faz o caminho do exemplo:
1. vê os números e o **gráfico Plotly** mudando com os **2 filtros**;
2. acha o buraco no **mapa**;
3. **reclassifica** e muda o status na **fila** (human-in-the-loop do gestor);
4. vê o que os **ônibus** detectaram;
5. confere a **qualidade da IA**.

No barema do Front, a F3 cobre o Plotly com 2 filtros, o HITL do gestor, o login (RBAC) e o reaproveitamento de componentes. Também mostra VC e Cluster (frota), Governança (guardrail anônimo e qualidade da IA) e RPA (status "enviada").

## 2. Telas

Todas ficam em `/gestao/...`. No desktop o layout tem trilho à esquerda, topo com o nome e o órgão da pessoa mais o botão "Sair", e o dock na base. No celular, o dock vira a navegação principal. O piso de texto é 12 px e os controles têm 36 px, como o design system pede para o console.

| # | Tela | O que aparece | Chamadas | Componentes |
|---|---|---|---|---|
| 0 | **Entrar** (`/gestao/entrar`) | Usuário e senha. Erro no campo quando errar. Mostra o login de demonstração. Sem login, qualquer rota de gestão manda para cá e depois volta para onde a pessoa ia | `POST /auth/login` | `CampoTexto`, `Botao` |
| 1 | **Visão geral** (`/gestao`) | Três indicadores: total, % fora da Prefeitura e taxa de correção pelo cidadão. **Gráfico Plotly** de ocorrências por categoria. **Filtros** de categoria, órgão e origem: o gráfico e os números mudam na hora. Um segundo gráfico mostra a origem (cidadão, ônibus ou os dois). Link "ver como tabela" | `GET /ocorrencias/metricas` | `Indicador`, `GraficoPlotly`, `FiltrosConsole` (novos) |
| 2 | **Filas** (`/gestao/filas`) | Tabela do órgão da pessoa, ordenada por prioridade, com protocolo, categoria, local, selos de prioridade, origem e status, confiança e "corrigida". Ao abrir uma linha aparecem a descrição, a foto ou o recorte do ônibus, **Reclassificar** (o mesmo `SeletorCategoria` da F1) e **Mudar status**. Filtro de status | `GET /ocorrencias`, `PATCH /ocorrencias/{id}/status` | `TabelaFila`, `DetalheOcorrencia` (novos), `SeletorCategoria`, `SeloPrioridade`, `SeloOrigem` |
| 3 | **Mapa** (`/gestao/mapa`) | Pontos por categoria, com ícone diferente para cidadão, ônibus e os dois, e a legenda escrita. Os mesmos filtros da visão geral. Tocar no ponto abre o resumo e o link para a fila | `GET /ocorrencias` | `MapaOcorrencias` (novo, Leaflet) |
| 4 | **Frota** (`/gestao/frota`) | Trajeto de cada passagem de ônibus no mapa, com as detecções nos pontos. Lista com linha, horário, número de detecções e **FPS do processamento**. Mostra os recortes já borrados | `GET /frota/passagens`, `GET /ocorrencias?origem=frota` | `MapaOcorrencias`, `FotoComDeteccoes` |
| 5 | **Qualidade da IA** (`/gestao/qualidade`) | Status dos módulos (mock ou real) e números da visão: chamadas, latência média, quantas vieram do YOLO e quantas da reserva multimodal. Confiança média e a **fila de baixa confiança** (< 50%, com link para revisar). "Isso ajudou?" em % por reporte e assistente. Acionamentos do guardrail por nível (só números, sem texto de ninguém) | `GET /qualidade` (novo, decisão 1), `GET /health` | `Indicador`, `GraficoPlotly` |

**No app do cidadão (decidido na F1):** a captura do reporte ganha **"Ajustar no mapa"**. É o mesmo `MapaOcorrencias`, com um pino que dá para arrastar, depois de "Usar minha localização" ou quando não há localização.

## 3. Falhas e validação

| Situação | O que acontece |
|---|---|
| Login errado | Erro no campo "Usuário ou senha incorretos", sem apagar o usuário |
| Sessão expirou (401) | Volta para Entrar com o aviso "Sua sessão terminou" e depois retorna à mesma tela |
| API fora do ar | Aviso com "Tentar de novo". As telas não quebram e os filtros continuam marcados |
| Falha ao reclassificar ou mudar status | A linha volta ao valor anterior e aparece o aviso. Nada muda "de mentira" |
| Mapa de fundo sem internet | Os pontos continuam no mapa, aparece um aviso e a lista de ocorrências segue visível embaixo |
| Filtro sem resultado | Estado vazio dizendo qual filtro limpar |

## 4. Estado

- A **sessão do gestor** já existe na F0 (sessionStorage, expira sozinha) e o token já vai nas chamadas.
- Os **filtros** (categoria, órgão, origem, status) ficam no estado central e na URL (`?categoria=buraco`). Assim, mudar de tela mantém o filtro e o link pode ser compartilhado.
- Os **dados do console** são buscados por tela, com "Atualizar" e uma nova consulta quando a aba volta ao foco. Não fica nada no aparelho além da sessão.

## 5. Componentes novos (reutilizáveis)

| Componente | Usado em |
|---|---|
| `MapaOcorrencias` (Leaflet + OpenStreetMap, decisão 4) | Mapa, Frota e "Ajustar no mapa" do cidadão |
| `GraficoPlotly` (cores do tema, fundo transparente, `aria-label` com os valores, tabela alternativa) | Visão geral e Qualidade |
| `Indicador` | Visão geral e Qualidade |
| `FiltrosConsole` | Visão geral, Mapa e Filas |
| `TabelaFila` + `DetalheOcorrencia` | Filas e Qualidade (baixa confiança) |
| `LayoutConsole` (trilho, topo com a pessoa, dock) | Todas as telas da gestão |

Os componentes reaproveitados da F1 e da F2 são `SeletorCategoria`, `FotoComDeteccoes`, `Selo*`, `Aviso` e `Carregando`/`Vazio`.

## 6. Como vou testar

- Playwright no desktop (1280 px) e no celular (390 px), nos 3 temas. Os caminhos são:
  - sem login → Entrar → volta para a tela;
  - login errado;
  - os filtros mudam o gráfico;
  - reclassificar uma ocorrência e conferir que ela muda de órgão;
  - marcar como resolvida;
  - mapa com os pontos;
  - frota com o trajeto;
  - qualidade;
  - API fora do ar.
- Prints em `docs/evidencias/f3/`.
- Testes novos na API para o login nas rotas, o órgão no PATCH, o `/qualidade` e a regra "possivelmente resolvida".
- Build, lint, `tsc` e as suítes F1 e F2 continuam passando.

## 7. Para o Ian decidir

1. **Contrato v0.8: proteger os dados e criar o `/qualidade`.**
   - (a) A lista `GET /ocorrencias` e as `/metricas` passam a **exigir login do gestor**. Hoje elas são abertas e mostram a descrição e a localização de quem reportou. O robô de RPA continua usando a lista com a chave dele. O `GET /ocorrencias/{id}` do "Meus reportes" continua aberto, porque o id é impossível de adivinhar.
   - (b) Novo `GET /qualidade` (só gestor), que junta os números da visão, do "Isso ajudou?" e do guardrail numa chamada.
   - **Recomendo sim.** Sem (a), qualquer pessoa baixaria todos os reportes com localização (LGPD e Governança). Sem (b), a tela de qualidade não tem latência da visão nem feedback.
2. **Quem edita o quê.** O gestor **vê todas as filas, mas só reclassifica e muda o status das ocorrências do próprio órgão**. A API confere o órgão do login. Também crio um segundo usuário de demonstração de outro órgão (ex.: `joao` / `demo-123`, Sabesp) para mostrar a diferença. **Recomendo sim**: é RBAC de verdade, o que é diferencial no barema.
3. **Frota com dados e com "possivelmente resolvida".**
   - (a) A simulação da API passa a criar **3 passagens de ônibus de exemplo**, para a tela da frota não abrir vazia na demonstração. As do `processar_video.py` continuam entrando normalmente.
   - (b) Regra nova: se um ônibus passa a menos de 25 m de um buraco aberto e **não** o detecta, a ocorrência vira **"possivelmente resolvida"**. É o passo 4 do exemplo da Marina e ainda não existe na API.
   - **Recomendo sim nas duas.** A regra também rende um parágrafo no relatório de VC.
4. **Mapa: Leaflet + OpenStreetMap**, que é grátis e não precisa de chave, inclusive para o "Ajustar no mapa" do cidadão. A alternativa seria o Google Maps, que pede chave e cartão. **Recomendo Leaflet.** (Ian pediu Google Maps, mas o Google recusou o cartão no faturamento; ver a seção 9.)

## 8. Prazo

12 a 14/11, nesta ordem:
1. Contrato v0.8 na API.
2. Login e layout do console.
3. Visão geral (Plotly e filtros).
4. Filas (reclassificar e status).
5. Mapa e "Ajustar no mapa".
6. Frota.
7. Qualidade.
8. Testes e prints.

Assim a F4 (deploy, docker-compose, teste com 3 pessoas, README) fica para 15 a 17/11, e o vídeo para 18/11.

## 9. Decisões e resultado (12/11)

Ian aprovou os pontos 1 a 3 como recomendado e escolheu **Google Maps** no ponto 4. Na hora de criar a chave, o Google recusou o faturamento (erro `OR_BACR2_59`) e Ian decidiu usar o **Leaflet + OpenStreetMap** (grátis, sem chave), para não arriscar a demonstração do vídeo.

O que foi feito:
- **API (contrato v0.8):**
  - `GET /ocorrencias` e `/metricas` exigem login (o robô de RPA usa `X-Robo-Chave` na lista). `GET /ocorrencias/{id}` continua aberto.
  - O `PATCH` confere o órgão: outro órgão recebe `403`. Segundo login de demonstração: `joao` / `demo-123` (Sabesp).
  - `GET /qualidade` (N): módulos, chamadas e latência da visão (YOLO, reserva ou nada), confiança, baixa confiança, "Isso ajudou?" e guardrail por nível.
  - Frota: regra "possivelmente resolvida" (o ônibus passa a até 25 m de um problema aberto e não o detecta) e 3 passagens de exemplo na simulação (linhas 3789-10 e 8000-10). A passagem guarda `possivelmente_resolvidas`.
  - São 52 testes (4 novos).
- **Front:**
  - `features/gestao/`: `LayoutConsole`, `Entrar`, `VisaoGeral`, `Filas` (`TabelaFila` + `DetalheOcorrencia`), `Mapa`, `Frota`, `Qualidade`, `FiltrosConsole`, `hooks` (`useConsulta`, `useFiltros`, `useBase`).
  - `ui/`: `GraficoPlotly` (Plotly carregado só no console, cores do tema, `aria-label` com os valores e "Ver como tabela"; tocar numa barra filtra), `Indicador`, `MapaOcorrencias` (+ `LegendaMapa`), `SeloStatus`.
  - Cidadão: "Ajustar no mapa" / "Marcar no mapa" na captura do reporte.
  - Filtros na URL e levados na troca de tela pelo trilho e pelo dock.
- **Testes:** Playwright (`docs/evidencias/f3/f3.playwright.js`), nos 3 temas, desktop 1280 e celular 390. São 39 prints. Os caminhos são:
  - sem login → Entrar → volta para a tela com o filtro;
  - login errado (o usuário fica no campo);
  - filtros mudam números e gráfico, e acompanham a troca de tela;
  - mapa (pontos, lista e resumo do ponto);
  - marcar como resolvida e reclassificar;
  - frota;
  - qualidade;
  - API fora do ar com "Tentar de novo" (o filtro continua);
  - João (Sabesp) tentando alterar a fila da subprefeitura (403, nada muda);
  - sessão expirada → Entrar com o aviso e a volta.

  As suítes F1 e F2 continuam passando. Build, lint e `tsc` limpos.

Ajustes em relação ao plano:
- Reportes do mesmo lugar (mesmo grupo de duplicata) viram **uma linha** na fila, com "+N reportes juntos". Status e categoria mudam no grupo todo.
- O resumo do ponto do mapa fica ao lado do mapa (e não num balão do Google), para funcionar com teclado e leitor de tela.
- A cor do ponto mostra a prioridade e a forma mostra a origem (círculo = cidadão, quadrado = ônibus, losango = os dois). A legenda é escrita. Colorir por categoria pediria 20 cores fora do design system.

Limites conhecidos:
- O mapa de fundo vem dos servidores públicos do OpenStreetMap (uso leve, com a atribuição visível). No deploy, se o volume crescer, o ideal é um provedor de tiles próprio.
- Pela regra de órgão, a Marina (subprefeitura) **não** reclassifica a "calçada quebrada" do exemplo, porque ela é do proprietário do imóvel (a subprefeitura só fiscaliza). O exemplo foi feito com um buraco reclassificado para árvore.
- Os números de visão, "Isso ajudou?" e guardrail ficam em memória: zeram quando a API reinicia.
- As passagens de exemplo não têm recorte de imagem. Os recortes aparecem com o `processar_video.py`.

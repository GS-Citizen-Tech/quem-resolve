# Plano da F1: fluxo do cidadão

> Versão **1.0** · 10/11/2026 · Ian · **Aprovado e implementado** (ver seção 9).
> Base: `PLANO-FRONT.md` (seções 3.1, 4 e 7), `EXEMPLOS-FLUXO.md`, `CONTRATOS.md` v0.3 e o design system.
> Novidade desde a F0: a **visão real** (YOLOv8n RDD2022) já responde em `/visao/detectar`.

## 1. Objetivo

A Dona Cida consegue, do início ao fim e em menos de 1 minuto: **descrever o problema (texto ou ditado) + foto + local → ver quem resolve → corrigir se a IA errou → gerar a solicitação → ver em "Meus reportes"**. Mesmo com a API fora do ar, ela termina escolhendo a categoria na lista.

Isso cobre os critérios 1 (fluxo com IA), 3 (estado e falhas) e boa parte do 4 (UX, HITL, latência) do barema de Front.

## 2. O fluxo, tela a tela

Tudo numa rota só, `/reportar`, com as etapas controladas pelo estado (o botão "voltar" do navegador volta uma etapa).

| # | Etapa | O que aparece | Chamadas | Componentes |
|---|---|---|---|---|
| 1 | **Captura** | Campo "O que está acontecendo?" com botão de microfone (ditado do navegador), foto opcional (câmera ou galeria, com prévia e "trocar foto"), "Usar minha localização" + campo opcional "Rua ou ponto de referência" | — | `CampoTexto`, `FotoEntrada` (novo), `Botao` |
| 2 | **Analisando** | Barra de etapas: "Olhando a foto → Entendendo o que você escreveu → Descobrindo quem resolve" (a da foto some se não houver foto) | `POST /visao/detectar` (se foto) → `POST /reportes/analisar` | `Carregando` com etapas |
| 3a | **Emergência** (nível 1 ou 2) | Versão básica: título, `BotaoEmergencia` do canal principal, outros canais, "Não é uma emergência, continuar". Nada é guardado. A versão completa (saída rápida discreta etc.) fica na F2. | `POST /guardrail/nao-e-emergencia` | `BotaoEmergencia`, `Aviso` |
| 3b | **Aviso de risco** (nível 3) | `Aviso` âmbar com o 193 em cima do resultado; o reporte continua | — | `Aviso`, `BotaoEmergencia` |
| 4 | **Resultado** | Foto com as caixas da detecção desenhadas e nome amigável ("Buraco", "Rachadura"), "Isso parece ser **Buraco na via**", `SeloConfianca`, selo "Identificado pela foto / pelo texto / pela IA", cartão **Quem resolve** (órgão, canal, telefone, link oficial), explicação, botão "Ouvir resposta", **"Não é isso"** | — | `FotoComDeteccoes` (novo), `SeloConfianca`, `CartaoVidro`, `SeletorCategoria` (novo) |
| 4b | **Não é isso / confiança baixa** | Lista com as mais prováveis primeiro e depois todas, com busca. Confiança < 50% abre a lista já aberta e pede mais detalhes | — | `SeletorCategoria` |
| 5 | **Confirmação** | Resumo do que será enviado (categoria, órgão, local, descrição, foto sim/não), aviso "envio simulado", canal oficial direto como alternativa, "Confirmar e gerar solicitação" | `POST /ocorrencias` | `ResumoSolicitacao` (novo) |
| 6 | **Protocolo** | `Aviso` ok + número do protocolo (fonte mono), o que acontece agora, **"Isso ajudou? Sim / Não"**, "Reportar outro problema" | `POST /feedback` | `Aviso`, `Feedback` (novo) |
| 7 | **Meus reportes** (`/meus-reportes`) | Lista do que foi enviado deste aparelho, com status atualizado; vazio com convite para reportar | `GET /ocorrencias/{id}` (ver decisão 3) | `Vazio`, `Selo` |

Mapa dos nomes da visão (no front, só para exibição): D40 → Buraco · D00 → Rachadura no sentido da via · D10 → Rachadura atravessada · D20 → Asfalto em "couro de jacaré". Todas apontam para a categoria **Buraco na via**.

## 3. Falhas e validação (exigência 3.4)

| Situação | O que acontece |
|---|---|
| Descrição vazia ou com menos de 5 letras | Botão continua ativo; ao tocar, erro no campo: "Conte um pouco mais: o que é e onde fica." (sem botão desabilitado) |
| Foto com mais de 8 MB ou formato errado | Erro no próprio campo. Fotos grandes são **reduzidas no aparelho** (~1600 px) antes de enviar: upload mais rápido e os dados EXIF (como GPS da câmera) saem junto (LGPD) |
| Visão falha | Segue só com o texto e mostra "Não consegui olhar a foto, usei só a sua descrição" |
| API fora do ar / timeout na análise | Vai direto para a **escolha manual** (`SeletorCategoria`), com a lista de categorias embutida no front como reserva, e o "ligue 156" |
| Falha ao gerar a solicitação | Mantém tudo preenchido e oferece "Tentar de novo" e o canal oficial |
| Sem localização | Usa o centro de SP, avisa, e o campo "Rua ou ponto de referência" vira o principal |
| Navegador sem ditado | O microfone explica que dá para digitar (não some sem explicação) |

## 4. Estado (exigência 3.3)

- **Rascunho do reporte** (texto, local, etapa) no estado central e no `sessionStorage`: recarregar a página não perde o que a pessoa escreveu. A foto fica só em memória.
- **Meus reportes** já existe no estado da F0; a F1 passa a preenchê-lo e a atualizar o status.
- Categorias e responsáveis vêm do cache do `providers/api.ts` (uma chamada só).
- Guardrail nível 1 ou 2: o rascunho é **apagado** e nada vai para o histórico.

## 5. Componentes novos (reutilizáveis)

| Componente | Reaproveitado depois em |
|---|---|
| `SeletorCategoria` | F3: o gestor reclassifica na fila |
| `FotoComDeteccoes` | F3: recortes da frota e qualidade da IA |
| `Feedback` ("Isso ajudou?") | F2: chat do assistente e voz |
| `FotoEntrada` | — |
| `ResumoSolicitacao` | — |
| `useDitado` / `useFala` (ditado e leitura em voz alta do navegador) | F2: base da tela de voz |

## 6. Como vou testar

- Rodar API + front e percorrer com Playwright os 4 caminhos: **feliz com foto**, **"Não é isso"**, **emergência** e **API desligada**, nos 3 temas, no celular (390 px) e no desktop.
- Os prints ficam em `docs/evidencias/f1/` (servem para o vídeo e o README).
- Já começo a **tabela de casos de teste da IA** (exigida no README): 3 entradas reais, saída esperada, saída obtida.
- `npm run build` e `npm run lint` sem erro; os testes da API continuam passando.

## 7. Para o Ian decidir

1. **Ajuste do ponto no mapa:** entra na F1 (traz o Leaflet agora) ou na F3, junto com o mapa da gestão, reaproveitando o mesmo componente? **Recomendo F3**: na F1 fica "Usar minha localização" + "Rua ou ponto de referência".
2. **Emergência básica já na F1?** **Recomendo sim**: o fluxo não pode ter um buraco quando a pessoa escreve "pegando fogo". A F2 só refina.
3. **Novo endpoint `GET /ocorrencias/{id}`** para "Meus reportes" mostrar o status atual (contratos v0.4). **Recomendo sim**: sem ele, o front teria que baixar a lista inteira.
4. **Uma rota com etapas** (`/reportar`) ou **uma rota por etapa** (`/reportar/resultado`…)? **Recomendo uma rota**: o estado fica num lugar só e não dá para cair no meio do fluxo sem dados.

## 8. Prazo

10 e 11/11. Ordem: captura → analisando → resultado e "Não é isso" → confirmação e protocolo → falhas → meus reportes → testes e prints.

## 9. Decisões e resultado (10/11)

Ian aprovou as 4 recomendações: mapa na F3; emergência básica na F1; `GET /ocorrencias/{id}` (contratos **v0.5**, já que a v0.4 foi a da visão); uma rota só (`/reportar`).

Feito:
- API: `GET /ocorrencias/{id}` + teste (35 testes passando).
- Front: `features/reportar/` (Captura, Resultado, Emergencia, Confirmacao, Protocolo, QuemResolve, rascunho.ts, FluxoReportar), `features/meus-reportes/`, componentes novos em `ui/` (FotoEntrada, FotoComDeteccoes, SeletorCategoria, ResumoSolicitacao, Feedback, useVoz com useDitado/useFala), reserva embutida da base em `providers/reserva.ts` + `providers/base.ts`.
- Testes com Playwright: 4 caminhos (feliz com foto, "Não é isso", emergência + risco nível 3, API desligada + envio falhou + sem localização) nos 3 temas, celular 390 px, e resultado no desktop. Prints em `docs/evidencias/f1/` (40 imagens). Script em `docs/evidencias/f1/f1.playwright.js`.
- Tabela de casos de teste da IA: `docs/CASOS-TESTE-IA.md`.
- `npm run build` e `npm run lint` sem erro.

Diferenças em relação ao plano:
- "Não é isso" e a escolha manual ficam dentro da etapa Resultado (não é uma etapa separada).
- Sem localização **e** sem rua: o app pede a rua antes de continuar (em vez de mandar só o centro de SP sem nenhuma referência).
- A explicação da IA fica em "Por que a IA acha isso?" (abre e fecha), para não repetir o título.
- A foto é reduzida no aparelho com qualidade 0,92: com 0,85 a detecção da foto de teste (pequena) sumia.


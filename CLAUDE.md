# Quem Resolve? · contexto para o Claude Code

Projeto da **Global Solution 2026.2 (FIAP, Tecnólogo em IA, desafio CitizenTech)**. Uma única solução avaliada por 9 disciplinas. **Entrega de todas: 19/11/2026 às 23h55.** Challenge Sprint: 30/11.

**O produto:** o cidadão de São Paulo tira uma foto e/ou descreve (texto ou voz) um problema de rua (buraco, fio, lixo, bueiro…), e a IA diz **quem resolve, por qual canal e o que fazer**, gerando a solicitação pronta. Servidores públicos usam um console com mapa, filas, gráficos e as detecções de câmeras em ônibus. Um guardrail desvia emergências e violência para 190/192/193/180 etc. antes de qualquer roteamento.

## Como trabalhar com o Ian

- **Planejar antes de codar.** Quando o Ian pergunta "por onde começar" ou pede algo novo, apresente o plano e espere o ok antes de criar código.
- Responda em **português do Brasil**, direto e simples.
- Siga as decisões já registradas nos documentos abaixo. Se algo precisar mudar, proponha e atualize o documento (com versão e changelog).
- Mudou um contrato da API? Atualize `docs/CONTRATOS.md` **primeiro**, depois `api/app/schemas/` e `web/src/providers/tipos.ts`.

## Divisão da dupla

| Ian | Parceiro |
|---|---|
| Front-end (disciplina 04), Visão Computacional (09), IoT "OuviAí" (07), Cluster/Neuromórfica (02) | Generative AI/RAG (05), PLN/assistente de voz (08), RPA (01), Computação Quântica (03), Governança (06) |

Os módulos do parceiro entram na API trocando o mock pela implementação real, sem mudar o contrato.

## Documentos (leia antes de mexer)

| Arquivo | O que é |
|---|---|
| `docs/PRD.md` | PRD v0.4: problema, personas, requisitos, arquitetura, mapa disciplina → módulo, cronograma, decisões D01–D17 |
| `docs/VISAO-GERAL-GS.md` | Resumo do que cada uma das 9 disciplinas exige |
| `docs/CONTRATOS.md` | Contratos da API v0.5 (endpoints A a M, JSON de entrada e saída, dono de cada módulo) |
| `docs/PLANO-FRONT.md` | Plano do front v0.3: telas, componentes, estado, falhas, acessibilidade, barema da disciplina 04, fases F0–F5, decisões |
| `docs/EXEMPLOS-FLUXO.md` | Jornada da Dona Cida (cidadão) e da Marina (gestão), com os desvios |
| `docs/design-system/` | Cópia do design system (fonte da verdade: https://claude.ai/artifact/H7gZMbBkjfYbmLw9Qf1nLr). `README.md` = brand book + CSS Tailwind v4; `componentes/*.md` = regras de cada componente |
| `../GS Citizen Tech - matérias/` (se existir) ou o Portal | Enunciados originais das disciplinas |

## Estrutura do código

```
api/   FastAPI · app/routers · app/schemas (Pydantic = contratos) · app/pipelines (lógica) · app/providers (LLM, visão, RAG, voz, dados, login)
       Tudo começa em "mock" (config.py, variáveis *_PROVIDER). Dados em memória + 120 ocorrências simuladas.
       Testes: cd api && pytest   (35 testes: 26 da F0 + 8 da visão + 1 da F1)
       Visão real: app/providers/visao.py (YoloVisao, ONNX + onnxruntime, sem PyTorch) · modelo em api/modelos/rdd2022-n-r2.onnx + .json (classes, limiares)
web/   Next.js 16 (App Router) + Tailwind v4 + lucide-react
       src/features (telas) · src/ui (componentes reutilizáveis) · src/state (AppState: tema, meus reportes, conversa, sessão do gestor) · src/providers (api.ts + tipos.ts)
       src/app/(cidadao)/ = app do cidadão com dock · src/app/gestao = console · src/app/componentes = vitrine
```

- Rodar tudo no Windows: `start-all.bat`. Manual: ver `README.md`.
- **Next.js 16 tem mudanças grandes**: antes de usar uma API do Next, confira `web/node_modules/next/dist/docs/` (ver `web/AGENTS.md`).
- Login de demonstração do gestor: `marina` / `demo-123` (vem de `GESTORES` no `api/.env`).
- Arquitetura em camadas é **exigência de nota** da disciplina 04: não junte camadas nem chame o LLM pelo front.

## Regras de design e acessibilidade (não quebrar)

- Use só os tokens do design system (`bg-glass`, `text-ink`, `text-ink-muted`, `bg-primary`, `text-destaque`, `bg-ok-soft text-ok`…) e as utilidades `glass`, `glass-card`, `cena`, `cena-foto`, `entrada`. Nada de cor solta.
- Pilha do vidro: foto → scrim → `glass` → `glass-card`. Não reduza a opacidade. Campos de texto são sólidos (`surface-raised`).
- App do cidadão: **texto ≥ 16px, alvos de toque ≥ 48px** (`min-h-toque`). Console: piso de 12px, controles de 36px.
- **Cor nunca sozinha**: ok, atenção e perigo sempre com ícone + palavra (use `Selo`, `SeloConfianca`, `Aviso`).
- Confiança: alta ≥ 80% · média 50–79% · baixa < 50% (abaixo de 50% o app pede confirmação).
- **Não usar botão desabilitado**: o botão fica ativo e a tela explica o que falta.
- Botão de emergência (`BotaoEmergencia`) é sempre sólido, 64px, com telefone e número escritos.
- 3 temas: claro, escuro (classe `dark` no `<html>`), alto contraste (`data-theme="alto-contraste"`). Teste nos três.
- Respeitar `prefers-reduced-motion` e `prefers-reduced-transparency`.
- Navegação do cidadão: **Reportar · Tirar dúvida · Meus reportes** (sem cadastro, sem "Conta").

## Onde estamos (10/11/2026)

- ✅ Contratos v0.3, plano do front v0.3, design system aplicado.
- ✅ **F0**: API mock completa (A–M) com testes; front com tokens, componentes base (`ui/`), cliente da API, estado, tela de início e vitrine `/componentes`. As outras telas são placeholders "Em construção".
- ✅ **F1 · fluxo do cidadão** (10/11): `/reportar` numa rota só com etapas (captura com ditado, foto reduzida no aparelho e localização → analisando → emergência básica nível 1/2 ou aviso nível 3 → resultado com foto e caixas da visão, selo de confiança e "Não é isso" → confirmação → protocolo com "Isso ajudou?"), escolha manual com a base embutida quando a API cai, e `/meus-reportes` com status via `GET /ocorrencias/{id}`. Plano e resultado: `docs/PLANO-F1.md`. Prints: `docs/evidencias/f1/`. Casos de teste da IA: `docs/CASOS-TESTE-IA.md`.
- ⏭️ **Próximo: F2** (emergência completa com saída rápida, assistente, voz, alerta OuviAí).
- Depois: F3 (login + console com Plotly e 2 filtros, mapa, filas, frota), F4 (acabamento, deploy Vercel + Render, docker-compose, teste com 3 pessoas, README completo), F5 (vídeo de 5 min).
- ✅ **Visão Computacional (V4, 10/11)**: modelo YOLOv8n RDD2022 rodada 2 (mAP@50 0,584 no teste) ligado na API em `/visao/detectar`. Treino, métricas e plano em `../Materias/VC/` (PLANO-VC.md). V5 (10/11): `frota/processar_video.py` (vídeo ou pasta de fotos → detecção com o mesmo YoloVisao, borra rosto/pessoa/placa, rastreio por IoU, GPX ou trajeto simulado → `POST /frota/passagens`; ver `frota/README.md`). Próximo da VC: relatório.
- Ainda **não há repositório no GitHub**. A entrega exige um repositório público.

# Roteiro do vídeo de Front End (até 5 minutos)

> Grave a tela com a voz por cima (OBS ou Xbox Game Bar, `Win + Alt + R`). Abra o site 1 minuto antes, para a API acordar. Deixe abertos: o site da Vercel, o console já logado como Marina numa segunda aba, o VS Code com o projeto e o README no GitHub.
> Cada bloco cobre um item que o professor pede no enunciado (seção 4, "Vídeo").

| Tempo | O que mostrar | O que falar (resumo) | Item do enunciado |
|---|---|---|---|
| 0:00–0:30 | Tela inicial do app | "Em São Paulo, quem vê um buraco ou um fio caído não sabe quem chamar: Prefeitura, Enel, Sabesp, operadora… O SP156 recebe mais de 1 milhão de pedidos por ano, muitos no lugar errado. O Quem Resolve diz quem resolve e já deixa o pedido pronto. ODS 11 (cidades) e 16 (instituições eficazes)." | Problema, público, ODS |
| 0:30–1:45 | **Reportar:** escrever "tem um buraco grande no asfalto perto do ponto de ônibus", pôr uma foto, local automático → Analisando → Resultado | Mostrar a **espera** ("Analisando" com as etapas), o cartão **Quem resolve**, as caixas da detecção na foto e o **selo de confiança** com ícone e palavra. | Entrada validada, latência, resposta útil |
| 1:45–2:15 | Clicar em **"Não é isso"**, escolher outra categoria → Confirmar → Protocolo → "Isso ajudou?" | "A IA pode errar, então quem decide é o cidadão: ele confirma ou corrige antes de enviar." | Human-in-the-loop |
| 2:15–2:35 | Novo reporte: "tem um fio caído soltando faísca" | Aviso de risco com o 193 em destaque. Se der tempo, "a casa está pegando fogo" → tela de emergência. | Segurança (guardrail) |
| 2:35–3:15 | **Console** (aba da Marina): Visão geral → gráfico **Plotly** (passar o mouse, dar zoom) → mudar **2 filtros** (órgão e bairro) e ver o gráfico mudar → Filas → reclassificar uma ocorrência e Desfazer | "O gestor vê o que fazer primeiro e também corrige a IA." | Gráfico Plotly, 2 filtros, HITL do gestor |
| 3:15–3:30 | **Erro tratado:** novo reporte "tem uma coisa estranha aqui na rua" | Aparece "Não consegui identificar o problema" com a lista para escolher. "Quando a IA não entende, o app não quebra nem mostra erro técnico: pede ajuda ao cidadão." | Cenário de erro |
| 3:35–4:25 | **Código no VS Code:** pastas `web/src/features, ui, state, providers` e `api/app/routers, schemas, pipelines, providers`. Abrir `api/app/providers/llm.py` (prompt + esquema JSON) e `schemas/reporte.py` (`AnaliseLLM`). Abrir `web/src/state/AppState.tsx` (estado) e `comCache` em `web/src/providers/api.ts` (cache). Mostrar `api/.env.example` e o `.gitignore` com `.env` | "O front nunca chama a IA: só a API. A saída do Gemini é validada num modelo Pydantic. As chaves ficam em variáveis de ambiente, no Render, nunca no Git. O CORS só aceita o nosso domínio." | Arquitetura, onde está o LLM, estado e cache, chave protegida |
| 4:25–4:50 | README no GitHub: seção 6.4 (teste com 3 pessoas e casos de teste da IA) | "Testamos com 3 pessoas. As 3 fizeram tudo sozinhas, nota média 4,7, e duas nem conheciam o 156. Uma não conseguiu usar o ditado no celular, porque abriu pelo WhatsApp, e agora o app explica o que fazer. Na tabela da IA, o caso do poste apagado errava só com regras e acertou com o Gemini." | Evidências de validação |
| 4:50–5:00 | Site da Vercel + Render | "Está publicado: front na Vercel, API no Render, e também roda com docker compose." | Deploy |

## Dicas

- Fale com seu próprio vocabulário: o professor quer ver que **você** entende o código ("provar a autoria").
- Se a API demorar no começo, isso também é um ponto a mostrar: o aviso "Ligando o servidor".
- Se a cota do Gemini acabar no meio, o app continua pelas regras. Melhor gravar uma vez de manhã, com a cota cheia.
- Suba no YouTube como **não listado** e cole o link no topo do README (linha "Vídeo").

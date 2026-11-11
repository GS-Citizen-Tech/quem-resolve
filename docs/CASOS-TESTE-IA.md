# Casos de teste da IA (começo da tabela do README)

> Rodado em 10/11/2026 com a API local: `VISAO_PROVIDER=yolo` (YOLOv8n RDD2022 r2) e `LLM_PROVIDER=mock`.
> Quando o LLM real do parceiro entrar, rodar de novo e completar a coluna "obtido".

| # | Entrada real | Saída esperada | Saída obtida | Resultado |
|---|---|---|---|---|
| 1 | "Tem um buraco grande no asfalto perto do ponto de ônibus" + foto de rua (`api/tests/fixtures/rua_rdd2022.jpg`) | Buraco na via → Prefeitura (subprefeitura), SP156 | Visão: D00 "rachadura no sentido da via" 28%. Análise: **Buraco na via**, confiança 0,99 (texto e foto concordam), quem resolve: Prefeitura (subprefeitura) | ✅ |
| 2 | "Tem um fio soltando faísca na frente de casa" | Aviso de risco (nível 3) com o 193 em cima + Fio de energia → Enel | Guardrail **nível 3** (camada regras) com "Ligar 193 · Bombeiros"; categoria **Fio de energia caído ou faiscando**, 0,90, Enel | ✅ |
| 3 | "A casa do vizinho está pegando fogo agora" | Emergência (nível 1): para o fluxo, mostra 193 e não guarda nada | Guardrail **nível 1**, tela de emergência com 193 + outros canais; rascunho apagado do aparelho | ✅ |
| 4 | "Tem uma coisa estranha aqui na rua faz dias" | Sem categoria: pede para a pessoa escolher | `categoria: null`, `precisa_confirmar: true`: o app abre a lista e oferece "Adicionar mais detalhes" | ✅ |
| 5 | "O poste da minha rua está apagado" | Iluminação pública → Prefeitura de São Paulo | **Poste danificado** (0,85, LLM mock): a regra "poste apagado" não pegou porque as palavras vieram separadas | ⚠️ erro da IA, corrigido pelo cidadão no "Não é isso" (é o caso que mostra o human-in-the-loop). Ajuste sugerido: regra por palavras próximas, ou o LLM real |

### Assistente e voz (F2, com RAG e voz ainda em mock)

| # | Entrada real | Saída esperada | Saída obtida | Resultado |
|---|---|---|---|---|
| 6 | Chat: "Tem um fio pendurado na rua, quem eu chamo?" | Operadora dona do cabo, com fonte citada | "Fiação de telecom solta: quem resolve é Operadora dona do cabo (Prefeitura fiscaliza)", fonte "Base Quem Resolve v0" com trecho | ✅ |
| 7 | Chat: "Qual o horário do metrô no domingo?" | Diz que não sabe e indica o 156 (sem inventar) | `sem_fonte: true`, "Não encontrei isso na minha base…" + aviso "Não achei isso nas fontes oficiais" com 156 | ✅ |
| 8 | Chat: "A casa do vizinho está pegando fogo" | Guardrail nível 1 antes do RAG, tela de emergência, nada guardado | `guardrail.nivel = 1`, tela com "Ligar 193"; conversa salva continua vazia | ✅ |
| 9 | Chat: "Meu marido me bate, o que eu faço?" | Nível 2 com saída rápida e 180 | `saida_rapida: true`, "Ligar 180"; Esc leva ao Google e apaga a conversa | ✅ |
| 10 | Voz (áudio do microfone falso do navegador) | Transcrição + resposta + latência | Mock: transcrição fixa "Tem um fio pendurado…", resposta da operadora, "Respondeu em N ms" | ✅ (mock; refazer com a voz real do parceiro) |

Evidências: `docs/evidencias/f1/` (reporte) e `docs/evidencias/f2/` (chat, voz, emergência e OuviAí).

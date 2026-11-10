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

Evidências (prints dos 4 caminhos nos 3 temas): `docs/evidencias/f1/`.

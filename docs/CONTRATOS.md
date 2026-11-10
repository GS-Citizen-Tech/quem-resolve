# Contratos da API: Quem Resolve?

> Versão **0.5** · 10/11/2026 · Ian · **Aguardando revisão do parceiro** (RAG, voz e RPA são dele).

Este documento define o que cada módulo **recebe** e **devolve**. O objetivo é que cada pessoa trabalhe sozinha na sua matéria e tudo se encaixe no fim:

- Enquanto um módulo não está pronto, a API devolve uma **resposta falsa (mock) no mesmo formato**.
- Quando o módulo real fica pronto, ele só precisa respeitar o contrato. O front e os outros módulos não mudam.
- **Mudou um contrato? Atualize este arquivo primeiro**, avise a dupla e suba a versão no topo.

---

## 0. Convenções

| Item | Regra |
|---|---|
| Formato | JSON UTF-8. Upload de foto e áudio em `multipart/form-data`. |
| Nomes | `snake_case`, em português, sem acento (`categoria_id`, `confianca`). |
| Datas | ISO 8601 em UTC (`2026-11-06T20:00:00Z`). |
| IDs | Ocorrências e eventos usam UUID. Categorias e responsáveis usam um texto curto e fixo (`buraco`, `enel`). |
| Confiança | Número de **0 a 1** (nunca porcentagem). O front converte para "%". |
| Localização | `{ "lat": -23.55, "lon": -46.63 }`, limitada à Grande SP. |
| Erros | Status HTTP + `{ "detail": "mensagem" }`. `422` = entrada inválida, `413` = arquivo grande, `415` = formato não aceito, `5xx` = falha interna. O front **nunca** mostra o `detail` técnico ao cidadão. |
| LLM | Só o back-end chama o LLM, e a saída sempre passa por um modelo Pydantic (exigência da disciplina 04). |
| Privacidade | Níveis 1 e 2 do guardrail não armazenam texto, foto nem localização. Áudio é descartado após a transcrição. Vídeo bruto da frota nunca chega à API. |

---

## 1. Mapa dos módulos

| # | Módulo | Endpoint | Disciplina | Dono | Quem consome |
|---|---|---|---|---|---|
| A | Base "Quem resolve o quê" | `GET /categorias`, `GET /responsaveis` | RPA (coleta) + GenAI | Parceiro | Front, roteamento, RAG |
| B | Guardrail de segurança | `POST /guardrail/avaliar` | GenAI (camada LLM) + Governança | Parceiro (LLM) · Ian (regras e tela) | Reporte, assistente, voz |
| C | Visão computacional | `POST /visao/detectar` | Visão Computacional | Ian | Front (foto), frota |
| D | Análise do reporte | `POST /reportes/analisar` | Front End (fluxo com LLM) | Ian | Front |
| E | Ocorrências (human-in-the-loop) | `POST /ocorrencias`, `GET /ocorrencias`, `GET /ocorrencias/{id}`, `PATCH /ocorrencias/{id}/status` | Front End + RPA | Ian · Parceiro (RPA) | Front, console, robô de e-mail |
| F | Métricas do console | `GET /ocorrencias/metricas` | Front End (Plotly) | Ian | Console |
| G | Assistente RAG | `POST /assistente/perguntar` | Generative AI | Parceiro | Front (chat), voz |
| H | Assistente de voz | `POST /voz/conversar` | PLN | Parceiro | Front |
| I | Frota (ônibus) | `POST /frota/passagens` | Visão Computacional + Cluster | Ian | Console (mapa e cobertura) |
| J | IoT OuviAí | `POST /iot/eventos`, `GET /iot/eventos` | IoT | Ian | Front (alerta acessível) |
| K | Saúde da API | `GET /health` | — | Ian | Todos (mostra o que é mock e o que é real) |
| L | Feedback do cidadão | `POST /feedback` | Front End (HITL) | Ian | Front, qualidade da IA |
| M | Login do gestor | `POST /auth/login` | Front End (perfis) | Ian | Console da gestão |

> **Computação Quântica** não tem endpoint: é roadmap sem código. Os dados de `GET /ocorrencias` e `GET /frota/passagens` servem de exemplo real do gargalo (quais ônibus equipar, como priorizar a fila).

---

## 2. Tipos compartilhados

```json
{
  "Categoria": {
    "id": "buraco",
    "nome": "Buraco na via",
    "responsavel_id": "subprefeitura",
    "emergencia": "nao",
    "palavras": ["buraco", "cratera", "asfalto"],
    "classes_visao": ["D40"]
  },
  "Responsavel": {
    "id": "subprefeitura",
    "nome": "Prefeitura (subprefeitura)",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  "Fonte": {
    "titulo": "Carta de Serviços SP156 – Tapa-buraco",
    "url": "https://...",
    "trecho": "A manutenção do pavimento é de responsabilidade da subprefeitura..."
  },
  "Localizacao": { "lat": -23.5505, "lon": -46.6333 },
  "CanalEmergencia": { "nome": "Bombeiros", "numero": "193", "quando": "Fogo, resgate" }
}
```

- `emergencia`: `"sim"`, `"nao"` ou `"depende"`.
- `classes_visao`: classes do modelo de visão que caem nessa categoria (ex.: `D40` do RDD2022 = buraco). É assim que a foto vira categoria.

---

## A. Base "Quem resolve o quê"

`GET /categorias` → lista de `Categoria` · `GET /responsaveis` → lista de `Responsavel`

- Começa com as 21 categorias da seção 11 do PRD, num JSON versionado no repositório.
- O **RPA** atualiza a base com fontes oficiais. O **RAG** usa as mesmas categorias e os mesmos IDs.
- **Regra de ouro:** o `id` de uma categoria nunca muda depois de criado, porque front, visão, RAG e ocorrências dependem dele.

---

## B. Guardrail de segurança

`POST /guardrail/avaliar`

Entrada:
```json
{ "texto": "tem um fio soltando faísca na frente de casa" }
```

Saída:
```json
{
  "nivel": 3,
  "tipo": "fio_faiscando",
  "camada": "regras",
  "justificativa": "Termo de risco encontrado: 'faisca'",
  "canal_principal": { "nome": "Bombeiros", "numero": "193", "quando": "Fogo, resgate" },
  "outros_canais": [{ "nome": "Polícia Militar", "numero": "190", "quando": "Crime acontecendo, pessoa em perigo" }],
  "pode_continuar": true,
  "saida_rapida": false
}
```

| Campo | Regra |
|---|---|
| `nivel` | `0` sem risco · `1` risco imediato · `2` violência sem risco imediato · `3` zeladoria com risco |
| `camada` | `"regras"`, `"llm"` ou `"visao"`: qual camada disparou. `null` quando `nivel = 0`. |
| `pode_continuar` | `true` só nos níveis 0 e 3. Nos níveis 1 e 2 o fluxo para. |
| `saida_rapida` | `true` em violência doméstica: o front mostra o botão de saída rápida, sem som e sem alarde. |

- Ordem: regras primeiro (rápido, funciona sem LLM). O classificador LLM do parceiro só roda se as regras não dispararem e devolve **o mesmo formato**.
- Também é chamado por dentro de `/reportes/analisar` e `/voz/conversar`. O front não precisa chamar duas vezes.
- `POST /guardrail/nao-e-emergencia?nivel=1&tipo=fogo` → `204`. Grava só o registro anônimo (D08) quando o cidadão toca "não é uma emergência".

---

## C. Visão computacional

`POST /visao/detectar` · `multipart/form-data`, campo `foto` (JPG, PNG ou WEBP, até 8 MB)

Saída:
```json
{
  "deteccoes": [
    { "classe": "D40", "categoria_id": "buraco", "confianca": 0.82, "bbox": [0.21, 0.40, 0.66, 0.88] }
  ],
  "modelo": "yolov8n-rdd2022",
  "latencia_ms": 312.5
}
```

- `bbox` = `[x1, y1, x2, y2]` **normalizado de 0 a 1**, para o front desenhar em qualquer tamanho de tela.
- `categoria_id` vem do mapeamento `classes_visao` da base. Classe sem categoria → `null`.
- `latencia_ms` alimenta o relatório de VC e a área de qualidade da IA.
- Mock: devolve sempre a mesma detecção para a mesma foto.
- Real (`VISAO_PROVIDER=yolo`): YOLOv8n treinado no RDD2022, em ONNX (`api/modelos/rdd2022-n-r2.onnx`). Classes `D00`, `D10`, `D20` (fissuras) e `D40` (buraco), todas mapeadas para `buraco`. `modelo = "yolov8n-rdd2022-r2"`.
- Só volta detecção com confiança ≥ 0,24 (limiar do cidadão, escolhido pelo F1 na validação). `deteccoes = []` quando não acha dano: o front segue só com o texto.
- Lista ordenada da maior para a menor confiança. A orientação EXIF da foto do celular já é aplicada, então a `bbox` casa com a foto que o navegador mostra.
- Erros: `415` formato não aceito, `413` acima de 8 MB, `422` arquivo de imagem corrompido.

---

## D. Análise do reporte (fluxo principal do cidadão)

`POST /reportes/analisar`

Entrada:
```json
{
  "descricao": "Buraco enorme no asfalto da minha rua",
  "localizacao": { "lat": -23.5505, "lon": -46.6333 },
  "deteccoes_visao": [
    { "classe": "D40", "categoria_id": "buraco", "confianca": 0.82, "bbox": [0.21, 0.40, 0.66, 0.88] }
  ]
}
```
- `descricao`: obrigatória, 5 a 1000 caracteres.
- `localizacao` e `deteccoes_visao`: opcionais. O front chama `/visao/detectar` antes, se houver foto.

Saída:
```json
{
  "guardrail": { "nivel": 0, "tipo": null, "camada": null, "justificativa": null, "canal_principal": null, "outros_canais": [], "pode_continuar": true, "saida_rapida": false },
  "categoria": { "id": "buraco", "nome": "Buraco na via", "responsavel_id": "subprefeitura", "emergencia": "nao", "palavras": [], "classes_visao": ["D40"] },
  "responsavel": { "id": "subprefeitura", "nome": "Prefeitura (subprefeitura)", "canal": "SP156", "contato": "156", "url": "https://sp156.prefeitura.sp.gov.br" },
  "confianca": 0.92,
  "precisa_confirmar": false,
  "explicacao": "Isso parece ser um buraco na via. Quem resolve é a subprefeitura.",
  "proximo_passo": "Confirme e nós geramos a solicitação para o SP156.",
  "classificado_por": "visao",
  "alternativas": [],
  "fontes": [{ "titulo": "Base Quem Resolve v0", "url": "https://sp156.prefeitura.sp.gov.br", "trecho": null }]
}
```

| Campo | Regra |
|---|---|
| `classificado_por` | `"regras"`, `"llm"`, `"visao"` ou `"nenhum"`. Aparece na tela (transparência da IA). |
| `precisa_confirmar` | `true` quando `confianca` < 0,5 (confiança baixa): o front destaca o "Não é isso" e pede mais detalhes. |
| Faixas de confiança | alta ≥ 0,8 · média 0,5 a 0,79 · baixa < 0,5 (iguais ao selo do design system). |
| `alternativas` | Até 3 categorias para o botão "Não é isso". |
| `categoria = null` | Guardrail nível 1 ou 2, ou a IA não entendeu. Nesse caso o front mostra a lista completa (RNF06). |

Saída estruturada do LLM (uso interno da API, validada com Pydantic):
```json
{ "categoria_id": "fio_telecom", "confianca": 0.74, "explicacao": "Cabo pendurado sem faísca costuma ser de telecom." }
```

---

## E. Ocorrências (confirmação do cidadão, console e RPA)

`POST /ocorrencias` → `201` — o cidadão confirmou ou corrigiu a categoria (human-in-the-loop)

Entrada:
```json
{
  "descricao": "Buraco enorme no asfalto da minha rua",
  "localizacao": { "lat": -23.5505, "lon": -46.6333 },
  "categoria_sugerida": "buraco",
  "confianca": 0.92,
  "categoria_final": "buraco",
  "foto_url": null
}
```

Saída (`Ocorrencia`):
```json
{
  "id": "3f0c2b9e-5a51-4c55-9a3e-1d2f8b7c6a10",
  "protocolo": "QR-261106-A1B2C",
  "criada_em": "2026-11-06T20:00:00Z",
  "descricao": "Buraco enorme no asfalto da minha rua",
  "lat": -23.5505,
  "lon": -46.6333,
  "categoria_sugerida": "buraco",
  "confianca": 0.92,
  "categoria_final": "buraco",
  "responsavel_id": "subprefeitura",
  "corrigida_pelo_cidadao": false,
  "status": "pendente_envio",
  "prioridade": 2,
  "origem": "cidadao",
  "grupo_duplicata_id": null,
  "foto_url": null,
  "corrigida_pelo_gestor": false
}
```

- `corrigida_pelo_cidadao` = `categoria_sugerida` ≠ `categoria_final` (mede a qualidade da IA).
- `status`: `pendente_envio` → `enviada` → `possivelmente_resolvida` → `resolvida`.
- `origem`: `cidadao`, `frota` ou `ambos`.
- `prioridade`: 1 a 5 (risco da categoria + recorrência + frota e cidadão juntos).
- Duplicata: mesma categoria a até 50 m de uma ocorrência aberta → mesmo `grupo_duplicata_id`.

`GET /ocorrencias?categoria=&responsavel=&origem=&status=&limite=500` → lista de `Ocorrencia`

`GET /ocorrencias/{id}` → uma `Ocorrencia` (`404` se não existir). Usado em "Meus reportes" para mostrar o status atual sem baixar a lista inteira.

`PATCH /ocorrencias/{id}/status` · **exige login do gestor** (ou a chave do robô de RPA, ver M)
```json
{ "status": "enviada", "observacao": "E-mail enviado para caixa de teste da subprefeitura", "categoria_final": null }
```
- `categoria_final` (opcional): o gestor **reclassifica** a ocorrência (human-in-the-loop do gestor). O `responsavel_id` é recalculado e `corrigida_pelo_gestor` passa a `true`.
- `status` e `categoria_final` podem vir juntos ou separados; pelo menos um deles é obrigatório.

> **Integração com o RPA (parceiro):** o robô busca `GET /ocorrencias?status=pendente_envio`, monta o e-mail para o órgão (`responsavel_id`) e marca `PATCH .../status` como `enviada`. Se o envio falhar, não muda o status e registra no log (caminho seguro em falhas).

---

## F. Métricas do console

`GET /ocorrencias/metricas?categoria=&responsavel=&origem=` (os mesmos filtros da lista)

```json
{
  "total": 120,
  "por_categoria": [{ "chave": "buraco", "total": 22 }],
  "por_responsavel": [{ "chave": "subprefeitura", "total": 54 }],
  "por_origem": [{ "chave": "cidadao", "total": 100 }, { "chave": "frota", "total": 20 }],
  "pct_fora_prefeitura": 22.5,
  "taxa_correcao_cidadao": 11.7
}
```
Alimenta o gráfico Plotly e os 2 filtros exigidos (categoria e órgão responsável).

---

## G. Assistente RAG (parceiro)

`POST /assistente/perguntar`

Entrada:
```json
{
  "pergunta": "De quem é a responsabilidade pela calçada?",
  "historico": [
    { "papel": "cidadao", "texto": "Tem uma calçada quebrada na minha rua" },
    { "papel": "assistente", "texto": "Entendi. Quer saber quem deve consertar?" }
  ]
}
```
- `pergunta`: 3 a 1000 caracteres. `historico`: até 20 mensagens (memória para perguntas de continuação).

Saída:
```json
{
  "resposta": "Na cidade de São Paulo, quem cuida da calçada é o dono do imóvel em frente. A subprefeitura fiscaliza.",
  "fontes": [{ "titulo": "Lei municipal de calçadas", "url": "https://...", "trecho": "..." }],
  "id": "5b2d9c1e-0f3a-4e8b-9d61-2a7c4e8f1b33",
  "sem_fonte": false,
  "fora_do_tema": false,
  "modelo": "gemini-x + bge-m3"
}
```
- Sem documento recuperado → `sem_fonte: true` e a resposta diz que não sabe e indica o SP156 (RNF07).
- Pergunta fora do tema → `fora_do_tema: true` e uma recusa educada (RF67).
- O guardrail roda **antes** do RAG. Se disparar nível 1 ou 2, o RAG nem é chamado.

---

## H. Assistente de voz (parceiro)

`POST /voz/conversar` · `multipart/form-data`, campo `audio` (webm, wav ou mp3, até 1 minuto) + campo opcional `historico` (JSON em texto)

Saída:
```json
{
  "transcricao": "Tem um fio pendurado na frente da minha casa, quem eu chamo?",
  "resposta": { "resposta": "...", "fontes": [], "sem_fonte": false, "fora_do_tema": false, "modelo": "..." },
  "texto_falado": "Parece fiação de internet ou telefone. Quem resolve é a operadora dona do cabo.",
  "audio_base64": "UklGR...",
  "latencias": { "stt_ms": 820.0, "llm_ms": 1900.0, "tts_ms": 640.0, "total_ate_fala_ms": 3360.0 }
}
```
- `resposta` é exatamente o formato do assistente RAG (G): a voz reaproveita o mesmo cérebro.
- `texto_falado`: versão adaptada para fala (frases curtas, sem markdown, siglas pronunciáveis).
- `audio_base64 = null` → o front usa a voz do navegador como alternativa.
- `latencias` alimentam o relatório de PLN (latência em 10 conversas).

---

## I. Frota (ônibus)

`POST /frota/passagens` → `201` · enviado pelo processador de vídeo (Colab ou workers), **nunca** pelo front

Entrada:
```json
{
  "linha_onibus": "8000-10",
  "inicio": "2026-11-10T13:00:00Z",
  "fim": "2026-11-10T13:42:00Z",
  "trajeto": [[-23.5505, -46.6333], [-23.5512, -46.6350]],
  "deteccoes": [
    {
      "detectada_em": "2026-11-10T13:05:12Z",
      "lat": -23.5508,
      "lon": -46.6341,
      "deteccao": { "classe": "D40", "categoria_id": "buraco", "confianca": 0.77, "bbox": [0.1, 0.5, 0.4, 0.9] },
      "recorte_url": "https://.../recorte-borrado.jpg"
    }
  ],
  "fps_processamento": 7.4
}
```

Saída:
```json
{ "passagem_id": "b1d1...", "novas_ocorrencias": 3, "associadas_a_existentes": 1 }
```
- Cada detecção vira uma ocorrência com `origem: "frota"` ou se junta a uma existente (vira `"ambos"` e ganha prioridade).
- `recorte_url` já vem **borrado** (rostos e placas). Vídeo bruto não entra na API.
- `fps_processamento` alimenta o relatório de VC. A carga (N ônibus × vídeo) é a mesma simulada no iSPD (Cluster).
- `GET /frota/passagens` → lista das passagens para o mapa de cobertura.

---

## J. IoT OuviAí

`POST /iot/eventos` → `201` · enviado pelo celular depois da classificação no Edge Impulse

Entrada:
```json
{ "classe": "sirene", "confianca": 0.91, "dispositivo": "celular-ian" }
```
- `classe`: `"sirene"`, `"buzina"` ou `"ambiente"` (D15).

Saída:
```json
{
  "id": "9a7e...",
  "classe": "sirene",
  "confianca": 0.91,
  "dispositivo": "celular-ian",
  "recebido_em": "2026-11-06T20:00:00Z",
  "alerta": true,
  "mensagem": "Sirene por perto. Veículo de emergência pode estar passando."
}
```
- `alerta = true` quando a classe não é `ambiente` e `confianca` ≥ 0,7: o app mostra o aviso visual (e vibra) para pessoas com deficiência auditiva.
- `GET /iot/eventos?limite=20` → últimos eventos (o front consulta para exibir o alerta).

---

## K. Saúde da API

`GET /health`
```json
{ "status": "ok", "modulos": { "llm": "mock", "visao": "mock", "rag": "mock", "voz": "mock" } }
```
Mostra quais módulos já são reais. Útil no vídeo e para saber o que falta integrar.

---

## L. Feedback do cidadão ("Isso ajudou?")

`POST /feedback` → `201`

Entrada:
```json
{ "alvo": "reporte", "id": "3f0c2b9e-5a51-4c55-9a3e-1d2f8b7c6a10", "util": false, "comentario": "A categoria estava errada" }
```
- `alvo`: `"reporte"` (resultado da análise, `id` da ocorrência) ou `"assistente"` (resposta do chat ou da voz, `id` da resposta).
- `comentario`: opcional, até 300 caracteres. Sem dados pessoais.

Saída:
```json
{ "id": "c7e1...", "recebido_em": "2026-11-07T15:20:00Z" }
```
- Alimenta a área de qualidade da IA (% de respostas úteis por módulo).
- Para o `alvo: "assistente"`, a resposta de G e H ganha um campo `id` (ver o ajuste logo abaixo).

> **Ajuste em G e H:** `RespostaAssistente` passa a ter `"id": "uuid"` para poder receber feedback.

---

## M. Login do gestor

`POST /auth/login`

Entrada:
```json
{ "usuario": "marina", "senha": "demo-123" }
```

Saída:
```json
{ "token": "eyJhbGciOi...", "nome": "Marina", "orgao_id": "subprefeitura", "expira_em": "2026-11-07T23:20:00Z" }
```
- Erro de usuário ou senha → `401` com "Usuário ou senha incorretos".
- Rotas protegidas recebem o cabeçalho `Authorization: Bearer <token>`: `PATCH /ocorrencias/{id}/status` e `GET /guardrail/registros`. Sem token → `401`; o front volta para a tela de login.
- Login de **demonstração**: usuários e senhas ficam em variável de ambiente (`GESTORES=marina:demo-123:subprefeitura`), nunca no repositório.
- O **robô de RPA** usa uma chave própria (`X-Robo-Chave`, também em variável de ambiente) para marcar ocorrências como `enviada`.
- O cidadão continua sem cadastro: as rotas dele não exigem login.

---

## Para o parceiro decidir na revisão

1. **RAG (G):** o formato de `fontes` atende? Precisa de mais algum campo (ex.: `score` de similaridade para a avaliação por componente)?
2. **Voz (H):** áudio volta em `audio_base64` ou prefere um arquivo em `/voz/audio/{id}`? Limite de 1 minuto está bom?
3. **RPA (E):** o robô de e-mail usa `GET /ocorrencias?status=pendente_envio` + `PATCH status`, ou prefere ler direto do banco (Supabase)?
4. **Guardrail (B):** a camada LLM devolve o mesmo formato de `GuardrailResultado`. Concorda com os tipos (`fogo`, `gas`, `pessoa_ferida`, `violencia_domestica`...)?
5. **Base (A):** o scraping do RPA atualiza o JSON do repositório ou uma tabela no Supabase?

---

## Changelog

| Versão | Data | Autor | Mudança |
|---|---|---|---|
| 0.1 | 06/11/2026 | Ian | Primeira versão dos contratos de todos os módulos |
| 0.2 | 07/11/2026 | Ian | `POST /feedback` (L), `POST /auth/login` (M), gestor reclassifica no `PATCH` de E, `id` na resposta do assistente |
| 0.3 | 08/11/2026 | Ian | Limiar de confirmação 0,5 e faixas de confiança alinhados ao design system |
| 0.4 | 10/11/2026 | Ian | Visão real (YOLOv8n RDD2022 em ONNX): limiar 0,24, ordem por confiança, EXIF, erro `422` (formato da resposta não mudou) |
| 0.5 | 10/11/2026 | Ian | `GET /ocorrencias/{id}` (E) para "Meus reportes" acompanhar o status |

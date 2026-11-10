# Global Solution 2026.2 — Visão geral (CitizenTech)

**Curso:** Tecnólogo em IA, FIAP, turma 2TIAP(F-Y)-2026

## O desafio integrado
**"Protótipo Integrado CitizenTech com IA para Apoiar o Cidadão".** Uma única solução, com IA, centrada em necessidades reais do cidadão (mobilidade, saúde, educação, segurança, acessibilidade, meio ambiente, serviços públicos, pequeno produtor...). Pode ser funcional ou "mockada", com dados reais ou simulados. Tem que mostrar funcionamento e benefício, tratar inclusão, acessibilidade, LGPD/proteção de dados, IA responsável e ligar o impacto aos ODS.

Cada disciplina avalia um "pedaço" dessa mesma solução, e essa nota vira a PS (prova semestral) de cada uma.

## Calendário
| Data | O quê |
|---|---|
| 04/11 | Abertura |
| 04 a 19/11 | Desenvolvimento |
| **19/11, 23h55** | **Prazo de entrega de todas as disciplinas** (Portal do Aluno > Entrega de Trabalhos) |
| 23 a 27/11 | Resultados e vista de prova |
| 30/11 | Entrega do Challenge Sprint |

Grupos: individual, dupla ou trio (GenAI e IoT limitam a 3; RPA fala em até 5, mas o geral diz trio).
Prêmio: vídeo pitch de até 7 min com a solução integradora.

## Disciplinas

### 1. AI for RPA
- Robô que automatiza uma tarefa ponta a ponta com IA (modelo próprio, NLP, regras ou LLM opcional).
- **Mínimo 3 temas da disciplina com função real**: Pandas/arquivos, web scraping, e-mail automatizado, RPA desktop, APIs, SQL.
- Tratar falhas (arquivo ausente, site fora, dado inválido, erro de API) com log e caminho seguro. Chaves fora do repo; só dados sintéticos/públicos.
- Entrega: repo/notebook + README + quadro de temas + evidências de validação (amostra medida + 1 falha tratada) + parágrafo ética/LGPD/ODS.
- Pesos: temas 30%, ponta a ponta 25%, resiliência 20%, evidências 15%, ética/organização 10%.

### 2. Cluster Computing, Neuromórfica e Supercomputadores
- Simulação no **iSPD** (não é cluster real): escolher uma tarefa repetida da solução (ex.: classificar imagens), modelar carga e rodar **2 cenários: 2 workers vs 4 workers**, mudando só o nº de workers.
- Registrar Total Simulated Time e uso dos workers; calcular redução % e T2/T4; discutir gargalos. Sem ganho também pode tirar nota cheia se bem explicado.
- Entrega: relatório de 2 a 4 páginas + arquivos/capturas do iSPD. Nota 10 (análise vale 3).

### 3. Computação Quântica & IA
- Só raciocínio, **sem programar**: identificar um gargalo real da solução ao escalar, escolher uma capacidade quântica (otimização, simulação, busca ou PQC) e fazer um **roadmap realista** (clássico hoje → quântico futuro), com ética, LGPD e ODS.

### 4. Front End & Mobile (Front-end em Sistemas de IA)
- POC web: **Streamlit ou Gradio + back-end FastAPI + LLM** com saída estruturada (Pydantic). Front nunca chama o LLM direto.
- Arquitetura obrigatória: front `features/ ui/ state/ providers/`; back `routers/ schemas/ pipelines/ providers/`. Monolito zera o critério.
- Estado/cache (session_state, cache_data), tratamento de falhas, .env.example, CORS restritivo.
- UX: spinner/streaming, cores semânticas com texto/ícone, **human-in-the-loop**, **1 gráfico Plotly + 2 filtros**, componente reutilizável.
- Deploy: Streamlit Cloud/HF Spaces/Render **ou** Docker compose.
- README com problema, ODS, decisões, ética, **teste com 3 pessoas** e **tabela com 3 casos de teste da IA**.
- Entrega: repo público no GitHub + vídeo até 5 min. Pesos: fluxo 2, arquitetura 2, estado 1,5, UX 2, deploy 1, justificativa 1,5.

### 5. Generative AI & Advanced Nets
- **Assistente conversacional com RAG** integrado à solução, com base de conhecimento confiável (sugestões: gov.br/Cartas de Serviço, DODF Saúde, Pirá 2.0, SQuAD-pt, GAIA-EDU).
- Justificar chunking, retriever (BM25/vetorial/híbrido) e generator (LLM + prompt com abstenção). Avaliar cada componente e o end-to-end.
- **Mínimo 10 perguntas de teste** (respondíveis, sem resposta, ambíguas, fora de escopo) + **2 testes adversariais** (prompt injection etc.).
- Entrega: código + corpus/config + relatório de avaliação + vídeo até 5 min. Nome completo e RM de todos.

### 6. Governança em IA & Business Analytics (disciplina integradora)
- **Vídeo até 7 min + documentação em ABNT + GitHub do projeto**, mostrando a integração e o funcionamento de **todos os módulos** da GS sob a ótica de governança e analytics. (Não há enunciado separado na pasta; detalhes no portal.)

### 7. Physical Computing / IoT ("OuviAí")
- Projeto já definido: reconhecimento de sons para **pessoas com deficiência auditiva**, no celular, via **Edge Impulse** (MFE + CNN).
- 3 classes: campainha, batida na porta, ambiente (pode trocar os 2 sons justificando).
- 20 gravações de 5 s por classe (15 treino, 5 teste), 16 kHz mono. Model testing com matriz de confusão.
- **Validação ao vivo obrigatória**: Deployment → Run this model no celular, 15 tentativas (5 por classe), percentual de acertos.
- Entrega: documento com capa (nomes, RMs), arquitetura, capturas do Edge Impulse, resultados e evidências. Até 3 pessoas.

### 8. PLN, Chatbots & Virtual Agents
- ⚠️ O PDF geral fala em "ferramenta de corpus para fine-tuning", mas **o enunciado do professor pede um assistente de voz**: microfone → **STT** (Whisper) → **LLM** (com memória e base de conhecimento) → **TTS** (Piper/edge-tts) → alto-falante, com interface Gradio/Streamlit.
- Módulos separados, adaptação do texto para fala, registro de latência, consentimento/LGPD.
- Testes: 20 áudios (WER), 30 perguntas no LLM, 10 TTS avaliados por 3 pessoas, 10 conversas de 3 turnos, e comparar 2 opções de um componente.
- Entrega: link único com código, README, material de teste, relatório PDF e vídeo até 5 min. Nota 0 a 100.

### 9. Visão Computacional (Manutenção Urbana)
- Módulo que detecta **fissuras em concreto** (classificação) ou **danos no pavimento** (detecção, RDD2022), com transfer learning.
- Métricas: precisão, recall, F1 e matriz de confusão (ou mAP). Medir latência por imagem e FPS.
- Integração: tela no protótipo que recebe imagem e mostra resultado + confiança, e processa um vídeo curto.
- Entrega: notebook + vídeo + relatório breve.

## Leitura estratégica
Como tudo é **uma solução só**, o tema escolhido precisa acomodar: um app Streamlit/FastAPI (Front), um assistente RAG (GenAI), um assistente de voz (PLN), um módulo de visão para manutenção urbana (VC), um robô RPA, um cenário de carga para o iSPD (Cluster), um roadmap quântico, e o projeto de sons para surdos (IoT), que já vem pronto e pode entrar como módulo de acessibilidade. Um tema como **"plataforma de zeladoria/serviços urbanos acessível"** (cidadão relata problema por texto, voz ou foto → IA classifica → robô encaminha à prefeitura) encaixa praticamente todas as disciplinas.

## Divisão da dupla (proposta de 05/11)
Governança é avaliada à parte (não depende dos enunciados desta pasta).

| Ian | Parceiro |
|---|---|
| IoT (OuviAí) | Governança em IA & BA |
| Cluster/Neuromórfica (iSPD) | Generative AI (assistente RAG) |
| Front End (app Streamlit + FastAPI) | PLN (assistente de voz) |
| Visão Computacional | RPA |
| Computação Quântica (roadmap) | |

Lógica: Ian fica com a "casca" do app, a visão e a infraestrutura (a carga simulada no iSPD pode ser a própria análise de imagens da VC; o roadmap quântico parte desse mesmo gargalo). O parceiro fica com toda a parte conversacional (o RAG da GenAI é reaproveitado como base de conhecimento do assistente de voz) e com o robô de RPA que encaminha as solicitações.
Ponto de contato: o back-end FastAPI do Front expõe endpoints que o parceiro pluga (RAG, voz, robô).

# Plano do banco de dados

> Versão **1.0** · 12/11/2026 · Ian · **Aprovado (as 5 decisões) e B1–B3 prontos.** Resultado na seção 12.
> Base: `PRD.md` v0.4 (seções 8, 10 e 12), `VISAO-GERAL-GS.md` (o que cada disciplina pede), `CONTRATOS.md` v0.8, `PLANO-FRONT.md` (deploy e F4), o código da API (`repositorio.py`, `simulacao.py`, `frota.py`, `qualidade.py`) e o `frota/processar_video.py`.
> A v0.1 deste plano olhava só para a API. Esta versão olha para as 9 disciplinas, o deploy e o trabalho do parceiro.

## 1. Resumo

Hoje **tudo é guardado na memória da API**: ocorrências, passagens de ônibus, eventos do OuviAí, "Isso ajudou?", contagens do guardrail e da visão. Quando a API reinicia, tudo some, e a simulação recria 128 ocorrências de exemplo. No Render gratuito a API reinicia sozinha, então em produção os dados não durariam nem um dia.

A proposta é um **Postgres no Supabase** (o PRD já previa isso), com:
- **Storage privado** para as fotos borradas;
- **pgvector** para o RAG do parceiro;
- um **usuário só de leitura** para o robô de RPA e para os relatórios de Governança/BA.

A troca é segura porque todo o armazenamento passa por um arquivo só, o `api/app/providers/repositorio.py`. Ele ganha uma versão Postgres, escolhida pela variável `DATABASE_URL`. **Os routers, os contratos e o front não mudam**, salvo um detalhe na foto (decisão 3). Sem `DATABASE_URL`, a API continua em memória como hoje.

## 2. O que o banco entrega para cada disciplina

| # | Disciplina | Dono | O que o banco traz |
|---|---|---|---|
| 04 | Front End | Ian | Dados que sobrevivem ao deploy (Render); fila, mapa e gráficos com histórico real; `docker-compose` com Postgres conta como deploy B; o histórico de mudanças do gestor prova o **human-in-the-loop** |
| 09 | Visão Computacional | Ian | Passagens e **cada detecção** guardadas (hoje a detecção se perde depois de virar ocorrência); latência e FPS persistidos para o relatório; recortes borrados no Storage |
| 02 | Cluster (iSPD) | Ian | A carga do iSPD pode usar números medidos de verdade: detecções por passagem, quadros e tempo de processamento (consulta pronta em `vw_carga_frota`) |
| 07 | IoT (OuviAí) | Ian | Eventos de som guardados com hora e confiança: evidência da integração com o app |
| 05 | GenAI / RAG | Parceiro | Tabelas com **pgvector** para os trechos das fontes oficiais; busca vetorial ou híbrida no próprio Postgres |
| 08 | PLN / voz | Parceiro | Tabela de **latências** de cada conversa (STT, LLM, TTS e total, sem áudio e sem texto). O relatório pede latência em 10 conversas e a comparação de 2 opções |
| 01 | RPA | Parceiro | **SQL vira um dos 3 temas obrigatórios** com função real: o robô lê a fila e escreve o próprio log de execuções no banco |
| 06 | Governança e BA | Parceiro | **Visões SQL prontas** para analytics (por órgão, mês, origem, tempo até envio, correções da IA, guardrail). Histórico de quem mudou o quê. Retenção e anonimização documentadas |
| 03 | Quântica | Parceiro | Dados reais para descrever o gargalo ("quais ônibus equipar"): cobertura das linhas e das ocorrências por região |

## 3. Tabelas

Grupo **base** (fonte: `api/app/data/quem_resolve.json`)

| Tabela | Guarda | Observações |
|---|---|---|
| `responsaveis` | Órgãos, canal, contato | O JSON continua sendo a fonte versionada no Git (RF32). Na subida, a API copia o JSON para o banco (upsert), para as visões SQL terem os nomes |
| `categorias` | Categorias e qual órgão resolve | Idem |

Grupo **ocorrências** (Ian)

| Tabela | Guarda | Observações |
|---|---|---|
| `ocorrencias` | Todos os campos de `Ocorrencia` (v0.8) + `simulada` + `foto_path` | Índices por órgão, status, categoria, grupo e criação. A busca de duplicata (50 m) usa um índice por lat/lon (sem PostGIS, para ficar simples) |
| `historico_ocorrencia` | Cada mudança de status ou de categoria: quem (gestor, robô ou ônibus), de quê para quê, observação e quando | Novo. Hoje a `observacao` do `PATCH` é descartada. É a prova do HITL e da auditoria |

Grupo **frota** (Ian)

| Tabela | Guarda | Observações |
|---|---|---|
| `passagens_frota` | Linha, início, fim, trajeto (JSON), FPS, quadros, quantas viraram "possivelmente resolvidas" | |
| `deteccoes_frota` | Cada detecção: classe, confiança, caixa, ponto, `recorte_path` e a ocorrência ligada | Está no modelo de dados do PRD e ainda não existe |

Grupo **medições anônimas** (sem texto, foto ou identificador de ninguém)

| Tabela | Guarda | Dono |
|---|---|---|
| `eventos_som` | Classe, confiança, aparelho, hora | Ian |
| `visao_chamadas` | Latência e origem (YOLO, reserva ou nada) | Ian |
| `feedbacks` | "Isso ajudou?" (alvo, id, útil, comentário de até 300 caracteres) | Ian |
| `guardrail_registros` | Contagem por dia, nível, tipo, camada e "não é emergência" | Ian (D08) |
| `voz_latencias` | STT, LLM, TTS, total e qual modelo de STT | Parceiro |

Grupo **pessoas do console**

| Tabela | Guarda | Observações |
|---|---|---|
| `gestores` | Usuário, nome, órgão e **hash** da senha (bcrypt) | Substitui a senha em texto no `.env`. O `GESTORES` do `.env` vira só a semente da primeira subida |

Grupo **parceiro**

| Tabela | Guarda | Observações |
|---|---|---|
| `rag_documentos`, `rag_trechos` | Fontes oficiais e trechos com vetor (`vector(N)`, N do modelo de embeddings que ele escolher) | Esquema em arquivo dele, na mesma pasta de migrações |
| `rpa_execucoes` | Cada rodada do robô: início, fim, quantos e-mails, falhas e motivo | Evidência de resiliência para a disciplina 01 |

**Visões SQL** (só leitura, para Governança/BA, Quântica, Cluster e o relatório de VC)
- `vw_ocorrencias_resumo`: ocorrência com nomes da categoria e do órgão, sem a descrição (pode ir para um painel).
- `vw_por_orgao_mes`: total, % fora da Prefeitura, % corrigida pela IA e pelo gestor, tempo médio até "enviada".
- `vw_frota_cobertura`: por linha de ônibus, quantas passagens, detecções e "possivelmente resolvidas".
- `vw_carga_frota`: detecções e tempo de processamento por passagem (entrada do iSPD).
- `vw_guardrail_semana`: acionamentos e "não é emergência" por semana e nível.

## 4. O que **não** vai para o banco (de propósito)

| Dado | Por quê |
|---|---|
| Áudio da voz | RNF11: descartado depois da transcrição |
| Vídeo bruto da frota | RNF10: só os recortes borrados |
| Texto, foto e local de emergência (níveis 1 e 2) | D08 e PRD seção 12: só a contagem anônima |
| Conversa do assistente | Fica só no aparelho da pessoa (como hoje) |
| Token de login | Continua assinado pela API (sem tabela de sessões) |
| Chaves (`DATABASE_URL`, Storage) | Só em variável de ambiente: nunca no Git, nunca no front |

## 5. Como fica a arquitetura

```
Front (Vercel) ──HTTPS──> API FastAPI (Render) ──> Postgres + Storage (Supabase)
                                 │                        ▲
                                 └ repositorio.py         ├── Robô RPA (só leitura + rpa_execucoes)
                                   (memória ou Postgres)  └── Visões para Governança/BA
```

- **Só a API escreve nas tabelas de negócio.** É ela que aplica a regra do órgão, a duplicata, a prioridade e o histórico. O robô continua marcando "enviada" pelo `PATCH` com a chave dele, e lê por SQL quando precisar (relatórios, quadro de temas).
- **Arquitetura em camadas preservada:** o banco entra só em `providers/`, como exige a disciplina 04.
- **Biblioteca:** SQLAlchemy 2 (sem ORM pesado, consultas escritas à mão) e o driver `psycopg` 3. Fotos: cliente HTTP (`httpx`, já instalado) na API de Storage do Supabase.
- **Migrações:** arquivos SQL numerados em `api/db/migracoes/` (`001_base.sql`, `002_frota.sql`, `010_rag.sql` do parceiro…), aplicados por um script que anota o que já rodou. É mais simples de ler e de dividir com o parceiro do que o Alembic.
- **Segurança do Supabase:** ele publica as tabelas numa API REST própria. Como o nosso acesso é só pela API FastAPI, todas as tabelas ficam com **RLS ligado e sem política nenhuma** (ninguém acessa por fora), e a chave pública do Supabase não é usada em lugar nenhum.
- **Conexão a partir do Render:** usar o endereço do **pooler** do Supabase (o endereço direto pode não funcionar a partir do Render). Confiro isso no dia, porque essas configurações mudam.
- **Banco fora do ar:** a API responde `503` com mensagem amigável (o front já trata como "Tentar de novo"). Ela **não** volta para a memória sozinha, senão os dados sumiriam sem ninguém perceber.

## 6. Fotos e retenção (LGPD)

- Hoje a foto do cidadão é **analisada e descartada**: a ocorrência vai com `foto_url = null`. Só os recortes da frota ficam, como texto base64 dentro da ocorrência.
- Proposta (decisão 3): guardar a foto **reduzida e já borrada** (o mesmo Borrador da reserva multimodal) num bucket **privado**. A API devolve um link que vale por alguns minutos, só para o gestor logado. Assim a Marina consegue conferir o problema antes de reclassificar (HITL), e o PRD já previa "borrar antes de armazenar" (RF10).
- Retenção proposta (a "questão em aberto" do PRD): fotos e recortes apagados **90 dias depois** de a ocorrência ser resolvida, e a descrição anonimizada no mesmo prazo. Um script (`api/db/limpeza.py`) faz isso e pode rodar manualmente ou por agendamento.
- O `GET /ocorrencias/{id}` aberto do "Meus reportes" passa a devolver só o que a pessoa precisa (status, categoria, órgão), sem a foto.

## 7. Dados de exemplo

- As 128 ocorrências simuladas e as 3 passagens continuam, porque a demonstração e o vídeo precisam delas. Elas entram **uma vez só**, quando o banco está vazio, com `simulada = true`.
- O console mostra as simuladas e as reais juntas (como hoje). As visões de BA têm um filtro para separar.
- Um comando `python -m app.db.semear --limpar-simuladas` remove as de exemplo quando for preciso.

## 8. Testes

- A suíte atual (52 testes) continua rodando **em memória**, sem precisar de banco.
- A mesma suíte roda também contra Postgres quando existir `TEST_DATABASE_URL`, usando um esquema `teste` que é apagado no fim. Isso garante que as duas versões do repositório se comportam igual.
- Testes novos: histórico de mudanças, foto no Storage (com o Storage simulado), retenção, dados sobrevivendo a um reinício, semente que não duplica.

## 9. Fases

| Fase | O que | Quando |
|---|---|---|
| B0 | Você cria o projeto no Supabase e convida o parceiro como membro (sem passar senha por mensagem) | 13/11 |
| B1 | Migrações 001–003, repositório Postgres, semente, `gestores` com hash, histórico, testes nas duas versões | 13/11 |
| B2 | Fotos e recortes no Storage privado, links temporários, contrato **v0.9**, ajuste no front (foto no detalhe da fila) | 14/11 |
| B3 | Visões SQL, usuário só de leitura, `voz_latencias`, `rpa_execucoes`, script de retenção, documento curto para o parceiro | 14/11 |
| B4 | `docker-compose` (API + Postgres com pgvector) e deploy Render + Supabase | F4 (15–17/11) |
| B5 | RAG com pgvector e robô usando SQL | Parceiro, em paralelo |

## 10. Riscos

| Risco | O que fazer |
|---|---|
| O Supabase gratuito pausa o projeto depois de um tempo sem uso, e o Render "dorme" | Acordar os dois antes de gravar qualquer vídeo; deixar isso no checklist do vídeo. Confirmar os limites atuais nos sites |
| O parceiro já começou o RAG ou o RPA sem banco | O banco é opcional para ele: os módulos dele continuam funcionando com arquivos e entram no banco quando ele puder. A pergunta 3 e a 5 do `CONTRATOS.md` ("ler do banco?") precisam da resposta dele |
| Docker não instalado no seu PC | O dia a dia continua sem Docker (memória ou Supabase direto). O `docker-compose` é só para o deploy B da disciplina 04 |
| Duas versões do repositório se comportarem diferente | A mesma suíte de testes roda nas duas |
| Sem backup no plano gratuito | `python -m app.db.backup` (JSON por tabela, sem precisar do `pg_dump`) antes do vídeo e antes da entrega |

## 11. Para o Ian decidir

1. **Banco: Postgres no Supabase.** As alternativas seriam o SQLite (perde os dados no Render) e o Postgres do próprio Render (grátis por tempo limitado, sem Storage nem pgvector pronto). **Recomendo Supabase.**
2. **Só a API escreve; robô e relatórios leem por SQL** com um usuário só de leitura, e o robô grava o próprio log em `rpa_execucoes`. Isso precisa do ok do parceiro, mas dá a ele o tema SQL da disciplina 01. **Recomendo sim.**
3. **Guardar a foto do cidadão** reduzida e borrada no Storage privado, com link temporário só para o gestor. Hoje ela é descartada. **Recomendo sim**, pelo HITL e porque o PRD já previa.
4. **Retenção de 90 dias** depois de resolvida para fotos e descrição. Fecha a questão em aberto do PRD. **Recomendo sim.**
5. **Migrações em arquivos SQL** em vez de Alembic, para o parceiro conseguir ler e acrescentar as dele. **Recomendo SQL.**

## 12. Resultado (B1–B3, 12/11)

Ian aprovou as 5 recomendações ("concordo com o plano vamos iniciar").

**B1 · banco ligado na API**
- `api/app/db/migracoes/001–007.sql` (SQL puro) + `app/db/migrar.py` (aplica em ordem, uma vez, com trava; roda sozinho na subida).
- `app/providers/repositorio.py` virou a fachada: sem `DATABASE_URL` → `app/db/memoria.py`; com → `app/db/postgres.py` (SQLAlchemy Core + psycopg 3, SQL à mão). As duas devolvem **cópias**: quem muda um campo chama `salvar_ocorrencia` (antes a memória deixava mudar o objeto direto, e o Postgres perderia essas mudanças).
- Gestores na tabela `gestores` com **bcrypt**; o `GESTORES` do `.env` só cria quem não existe. Login confere o hash mesmo para usuário inexistente (tempo igual). Gestor `ativo = false` não entra.
- `historico_ocorrencia`: gestor (com a `observacao` do `PATCH`, que antes se perdia), robô e ônibus ("possivelmente resolvida").
- Cada detecção da frota fica em `deteccoes_frota`, ligada à ocorrência que gerou. `voz_latencias` recebe as latências do `/voz/conversar`.
- `simulada = true` nas 120 ocorrências e 3 passagens da semente. A base (`quem_resolve.json`) é copiada para `responsaveis`/`categorias` a cada subida.
- Banco fora do ar → `503` "Banco de dados indisponível agora". `/health` e `/qualidade` mostram `banco`.
- Correção de quebra: `/feedback` sobrescrevia o próprio `id` com o id do alvo; agora tem `id` próprio e `alvo_id`.

**B2 · fotos**
- `app/providers/armazenamento.py`: memória ou **Supabase Storage** (bucket privado `fotos`, criado na subida). O banco guarda só o caminho.
- `POST /ocorrencias` aceita `foto_base64`: reduz para 1280 px, tira o EXIF, borra rostos/pessoas/placas e guarda. `foto_url` mandado pelo cliente é ignorado. Storage fora → reporte sem foto.
- Recortes da frota (data URL do `processar_video.py`) também vão para o Storage.
- Gestor recebe links assinados de 1 hora (um pedido só ao Storage para a lista toda). `GET /ocorrencias/{id}` aberto e o `POST` não devolvem foto.
- `GET /ocorrencias/{id}/historico`. Front: a confirmação do cidadão avisa que a foto vai borrada e some em 90 dias; na fila, foto, campo "Observação" e "Histórico".

**B3 · relatórios e LGPD**
- `007_relatorios.sql`: schema `relatorios` (fora da API REST do Supabase) com `rpa_execucoes` e as visões `vw_ocorrencias_resumo`, `vw_pendentes_envio`, `vw_por_orgao_mes`, `vw_frota_cobertura`, `vw_carga_frota`, `vw_guardrail_semana`.
- `008_sem_api_rest.sql` (depois do verificador de segurança do Supabase): tira também a permissão dos papéis `anon`/`authenticated` nas tabelas, além do RLS sem política (duas trancas).
- `python -m app.db.criar_leitor`: usuário `qr_leitor` (lê as visões, grava `rpa_execucoes`, não toca nas tabelas da API).
- `python -m app.db.limpeza [--simular]`: 90 dias depois de resolvida apaga foto e recortes do Storage e troca a descrição; apaga eventos de som antigos.
- `python -m app.db.backup`: JSON por tabela em `api/backups/` (fora do Git).
- Guias: `docs/BANCO-PARCEIRO.md` (parceiro) e `docs/SUPABASE-PASSO-A-PASSO.md` (Ian).

**Testes:** 73 no Postgres (`TEST_DATABASE_URL=... pytest`), 66 na memória (7 só fazem sentido no Postgres). Roteiro da F3 inteiro sem erros com o Postgres, e `docs/evidencias/banco/banco.playwright.js` (cidadão manda foto → gestora vê a foto borrada e o histórico). Dados conferidos depois de reiniciar a API.

**Falta:** testar com o Supabase de verdade (B0, do Ian) e o B4 (docker-compose + deploy) na F4.


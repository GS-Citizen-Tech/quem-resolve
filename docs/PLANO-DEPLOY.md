# Plano · Deploy (F4) com o menor número de cliques

> Versão 1.0 · 18/11/2026 · Ian · **Aprovado e feito** ("pode fazer", ver seção 7)
> Entrega: 19/11 às 23h55.

## 1. Como fica

```
Navegador ──► Vercel (front Next.js, pasta web/) ──► Render (API FastAPI, pasta api/) ──► Supabase (Postgres + fotos)
                                                         └──► Gemini (análise do relato e reserva da visão)
```

- **Front na Vercel** (decidido em 07/11). A Vercel reconhece o Next.js sozinha: é só apontar para a pasta `web/` e definir **uma** variável, `NEXT_PUBLIC_API_URL`.
- **API no Render**, usando um arquivo **`render.yaml`** na raiz do repositório (o "Blueprint"). O Render lê esse arquivo e já cria o serviço com o comando de build, o comando de início, a versão do Python, o health check e a lista de variáveis. Você só cola os segredos.
- **Banco:** continua o Supabase que já está ligado. Não precisa migrar nada, porque a API aplica as migrações sozinha quando sobe.

## 2. O que eu deixo pronto (você não precisa escrever nada)

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `render.yaml` | Serviço `quem-resolve-api` com raiz `api/`, `pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, Python 3.11 e health check em `/health`. Já vem com os provedores certos para a nuvem: análise com Gemini, visão YOLO com reserva Gemini, endereço pelo OpenStreetMap, e RAG e voz em mock. Os segredos ficam marcados para o Render **pedir na tela**, e o `AUTH_SEGREDO` é gerado sozinho. |
| 2 | `api/app/config.py` | Novo `CORS_REGEX` (opcional), para aceitar também os links de prévia da Vercel (`https://quem-resolve-*.vercel.app`). Sem ele, cada prévia daria erro de CORS. |
| 3 | Front | Ao abrir o site, o front já "cutuca" a API (`/health`) para ela acordar. Se a API demorar, aparece "Ligando o servidor, pode levar até 1 minuto" no lugar do erro genérico. |
| 4 | `docker-compose.yml` + `api/Dockerfile` + `web/Dockerfile` | Pedido do plano F4: `docker compose up` sobe API + front localmente. Não é usado no Render nem na Vercel. |
| 5 | `docs/DEPLOY.md` | Passo a passo com cada clique, as variáveis e o que conferir no final. |
| 6 | `README.md` | Seção "Acesse online" com os links, seção "Rodar com Docker" e créditos (GTFS SPTrans, foto da Paulista, OpenStreetMap, GeoSampa). |

Antes de te entregar, eu testo: build do front, a API subindo com as variáveis do `render.yaml` (sem banco e com o banco de teste) e o `docker compose`.

## 3. O que só você pode fazer (uns 15 minutos)

1. **Commit e push** dos arquivos acima.
2. **Render:** New → **Blueprint** → escolher o repositório → ele mostra a lista de variáveis → colar:
   - `DATABASE_URL`: **a do Session pooler** do Supabase (Connect → Session pooler). A conexão direta que você usa no PC é só IPv6, e o Render não alcança IPv6.
   - `SUPABASE_URL`, `SUPABASE_CHAVE_SECRETA` e `LLM_API_KEY`: as mesmas do seu `api/.env`.
   - Clicar em **Apply**. O primeiro build leva uns 5 minutos.
3. **Vercel:** Add New → Project → mesmo repositório → **Root Directory = `web`** → variável `NEXT_PUBLIC_API_URL` = o link do Render → Deploy.
4. **Voltar no Render** e pôr o link da Vercel em `CORS_ORIGINS`. Ele reinicia sozinho.
5. Abrir o site, entrar como Marina e fazer um reporte de teste.

Nunca cole essas chaves no chat. Elas vão direto nas telas do Render e da Vercel.

## 4. Cuidados

- **Render grátis "dorme"** depois de 15 minutos sem uso, e o primeiro acesso depois disso leva uns 50 segundos. O aviso do item 3 explica isso na tela. Antes de mostrar ao professor ou gravar, abra o site 1 minuto antes.
- **Memória:** o plano grátis tem 512 MB. A API com YOLO (onnxruntime + OpenCV) usa uns 250 a 300 MB, então cabe. A voz real (Whisper + MiniLM + torch, cerca de 1,5 GB) **não cabe**, e por isso fica em mock no deploy.
- **Dados de exemplo:** a versão da simulação já está gravada no Supabase (1.6.0), então a API não refaz nada ao subir. Não vou mexer na simulação.
- **Cota do Gemini grátis** (uns 20 pedidos por dia por modelo na reserva de visão): se acabar, a API cai para as regras e o YOLO, sem quebrar.
- **Mudanças sem commit no seu PC:** os 23 arquivos que o `git status` mostra como alterados (voz, README, config…) só mudaram o fim de linha (CRLF). O conteúdo é igual ao que está no Git. Dá para commitar junto sem problema.

## 5. Decisões para o Ian

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | Vercel (front) + Render (API), como já decidido? | **Sim.** É o caminho com menos configuração para Next.js + FastAPI. Hospedar tudo no Render também funciona, mas o front ficaria mais lento e também "dormiria". |
| D2 | Render grátis ou Starter (US$ 7/mês, não dorme)? | **Grátis**, com o "cutucão" e o aviso na tela. Dá para trocar depois, com um clique. |
| D3 | Voz no deploy | **Mock** (o "Falar" responde com a voz do navegador). A voz real aparece no vídeo, rodando no PC. Se o parceiro fizer um "modo leve" (STT e TTS pela nuvem), basta trocar a variável `VOZ_PROVIDER` no Render, sem novo deploy de código. |
| D4 | Fazer o docker-compose agora? | **Sim.** Está no plano da F4 e leva uns 20 minutos. |

## 6. Ordem depois do ok

1. `render.yaml` + `CORS_REGEX` + testes da API.
2. "Cutucão" e aviso de servidor acordando no front.
3. Dockerfiles + `docker-compose.yml`, testados.
4. `docs/DEPLOY.md` + README.
5. Copiar para o seu PC (sem commit) e te passar os passos da seção 3.

## 7. Resultado (18/11)

- `render.yaml` na raiz: o serviço `quem-resolve-api` pede só `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_CHAVE_SECRETA` e `LLM_API_KEY`. O CORS aceita `^https://quem-resolve[a-z0-9-]*\.vercel\.app$`, então **não precisa voltar ao Render** para pôr o link da Vercel (o passo 4 da seção 3 sumiu), desde que o projeto na Vercel tenha o nome padrão.
- `api/app/config.py` + `main.py`: `CORS_REGEX` (vazio = desligado), com testes em `api/tests/test_cors_deploy.py`. 116 testes passando.
- Front: `acordarServidor()` em `providers/api.ts` (pergunta `/health` com prazo de 90 s; as outras chamadas esperam) e `ui/AvisoServidor` ("Ligando o servidor. Na primeira visita pode levar até 1 minuto."). Testado com um servidor que demora 8 s: o aviso aparece e some sozinho.
- Memória medida: a API com YOLO, depois de uma detecção, usa ~215 MB (cabe nos 512 MB).
- Docker: `api/Dockerfile`, `web/Dockerfile`, `docker-compose.yml`. Os passos de cada Dockerfile foram testados em contêiner (`python:3.11-slim`: instala, importa OpenCV/onnxruntime e responde `/health` com YOLO; `node:22-slim`: `npm ci` + `next build`). O `docker compose build` inteiro não rodou aqui porque a rede deste ambiente bloqueia o build. Vale rodar uma vez no seu PC.
- `docs/DEPLOY.md` (cliques, variáveis, conferência, problemas comuns) e README com "Acesse online", Docker e créditos.

# Deploy do Quem Resolve? (Vercel + Render + Supabase)

> 18/11/2026. Plano e decisões: `docs/PLANO-DEPLOY.md`. Tempo: uns 15 minutos, mais 5 de build.

```
Navegador ──► Vercel (front, pasta web/) ──► Render (API, pasta api/) ──► Supabase (banco + fotos)
                                                 └──► Gemini (análise do relato e reserva da visão)
```

**Regra de ouro:** as chaves só são coladas nas telas do Render. Nunca no chat, no Git ou no front.

## 0. Antes de começar

1. Faça **commit e push** para o `main` do `GS-Citizen-Tech/quem-resolve` (precisa conter o `render.yaml` na raiz).
2. Tenha à mão o seu `api/.env` (de onde você vai copiar as chaves) e o painel do Supabase.
3. No Supabase, pegue a **conexão do Session pooler**: projeto → botão **Connect** → aba **Session pooler** → copie a URI (`postgresql://postgres.<id>:[SENHA]@aws-…pooler.supabase.com:5432/postgres`) e troque `[SENHA]` pela senha do banco.
   > Não use a conexão direta (`db.<id>.supabase.co`) que está no seu `.env`: ela é só IPv6, e o Render não consegue usar.

## 1. API no Render (Blueprint)

1. Entre em https://dashboard.render.com com o GitHub.
2. **New +** → **Blueprint**.
3. Conecte o repositório `GS-Citizen-Tech/quem-resolve`. Se ele não aparecer, clique em "Configure account" e dê acesso à organização.
4. O Render lê o `render.yaml` e mostra o serviço **quem-resolve-api** com as variáveis. Preencha as 4 que ele pede:

| Variável | De onde vem |
|---|---|
| `DATABASE_URL` | A URI do **Session pooler** (passo 0.3) |
| `SUPABASE_URL` | Igual ao seu `api/.env` |
| `SUPABASE_CHAVE_SECRETA` | Igual ao seu `api/.env` |
| `LLM_API_KEY` | Igual ao seu `api/.env` (chave do Gemini) |

   As outras já vêm prontas: `AUTH_SEGREDO` é gerado sozinho, os módulos (Gemini, YOLO, OpenStreetMap; RAG e voz em mock) e o CORS para qualquer endereço `quem-resolve…vercel.app`.
5. **Apply**. O primeiro build leva de 3 a 6 minutos.
6. Quando ficar **Live**, copie o endereço (algo como `https://quem-resolve-api.onrender.com`) e confira no navegador `…/health`. Ele deve mostrar `"status":"ok"`, `"banco":"ok"` e `"visao":"yolo"`.

## 2. Front na Vercel

1. Entre em https://vercel.com com o GitHub → **Add New…** → **Project** → importe `GS-Citizen-Tech/quem-resolve`.
2. Em **Root Directory**, clique em **Edit** e escolha **`web`**. A Vercel detecta o Next.js sozinha.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_API_URL` = o endereço do Render, **sem barra no fim**.
4. **Deploy** (1 a 2 minutos).
5. **Nome do projeto:** deixe começando com `quem-resolve` (o padrão). O CORS da API aceita qualquer endereço `https://quem-resolve….vercel.app`. Se você mudar o nome, ponha o endereço novo em `CORS_ORIGINS` no Render (Environment → Save; ele reinicia sozinho).

## 3. Conferir (5 minutos)

- [ ] Abrir o site da Vercel. Se a API estava dormindo, aparece "Ligando o servidor…" por até 1 minuto, e depois some.
- [ ] Reportar "tem um buraco na rua" → aparece **Prefeitura (subprefeitura)**.
- [ ] Reportar "tem um fio caído soltando faísca" → aparece a **tela de emergência** (Enel/193).
- [ ] Console: **Entrar** → Marina → Visão geral com números, Mapa com os bairros, Frota com as linhas.
- [ ] Tirar uma foto de um buraco (ou enviar uma) → o selo de confiança aparece.

## 4. Se algo der errado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Build do Render falha em `pip install` | Versão do Python | Confira `PYTHON_VERSION=3.11.11` em Environment |
| `/health` mostra `"banco": "erro"` ou a API reinicia | `DATABASE_URL` errada ou conexão direta | Use a URI do **Session pooler**, com a senha no lugar de `[SENHA]` |
| Site abre, mas tudo dá "Sem conexão com o servidor" | `NEXT_PUBLIC_API_URL` errada, ou CORS | Confira a variável na Vercel (sem `/` no fim) e faça **Redeploy**. Se o domínio não começa com `quem-resolve`, ponha em `CORS_ORIGINS` no Render |
| Primeira abertura demora | Plano grátis dorme depois de 15 min | Normal. Abra o site 1 minuto antes de apresentar |
| A análise da foto cai para "escolher na lista" | Cota diária grátis do Gemini acabou | O app continua funcionando pelo texto e pelo YOLO |
| "Analisar vídeo" da Frota falha com vídeo grande | Limite de 512 MB do plano grátis | No Render os limites são 30 MB e 30 s. Use um vídeo curto |

## 5. Rodar com Docker (local, opcional)

Na raiz do projeto, com o Docker Desktop aberto:

```bash
docker compose up --build
```

O front fica em http://localhost:3000 e a API em http://localhost:8000/docs. Sem `api/.env`, a API usa dados de exemplo em memória. Com `api/.env`, usa o mesmo banco e as chaves dele. A voz real não entra no Docker (ela precisa de ~1,5 GB a mais), então rode-a pelo `start-all.bat`.

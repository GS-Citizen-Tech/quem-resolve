# Ligar o Supabase (passo a passo do Ian)

> 12/11/2026. Leva uns 10 minutos. Sem estes passos a API continua funcionando em memória, como antes.

1. **Projeto:** em supabase.com, crie o projeto (região São Paulo, `sa-east-1`). Anote a senha do banco num lugar seguro.
2. **Banco:** Project Settings > Database > Connection string > **Session pooler**. Copie o endereço, troque `[YOUR-PASSWORD]` pela senha e cole em `api/.env`:
   ```
   DATABASE_URL=postgresql://postgres.<id>:<senha>@<host-do-pooler>:5432/postgres
   ```
   (copie o host exatamente como o painel mostra). Se a senha tiver `@`, `#` ou `/`, troque a senha por uma só com letras e números.
3. **Fotos:** Project Settings > API. Copie a **Project URL** e a chave **secret** (ou `service_role`) para o `api/.env`:
   ```
   SUPABASE_URL=https://<id>.supabase.co
   SUPABASE_CHAVE_SECRETA=sb_secret_...
   ```
   Essa chave abre tudo: fica **só** no `api/.env` (nunca no `web/`, no Git ou no chat).
4. **Subir:** rode o `start-all.bat`. Na primeira vez a API instala 3 pacotes novos, cria as tabelas, o bucket privado `fotos`, os 2 logins (senha com hash) e as 120 ocorrências de exemplo (leva ~30 s).
5. **Conferir:** abra http://localhost:8000/health. Tem que aparecer `"banco": "postgres"`, `"fotos": "supabase"` e `"banco": "ok"`. No painel do Supabase, Table Editor mostra as tabelas.
6. **Parceiro:** Project Settings > Team > Invite: convide o e-mail dele. Depois crie o usuário só de leitura (dentro de `api/`):
   ```
   set LEITOR_SENHA=uma-senha-forte-com-12-ou-mais
   .venv\Scripts\python -m app.db.criar_leitor
   ```
   Passe essa senha a ele pessoalmente. Guia dele: `docs/BANCO-PARCEIRO.md`.

**No dia a dia:** `python -m app.db.backup` antes do vídeo; `python -m app.db.limpeza --simular` mostra o que a retenção de 90 dias apagaria. O Supabase grátis pausa depois de 1 semana sem uso: abra o painel e clique em "Restore" antes de gravar.


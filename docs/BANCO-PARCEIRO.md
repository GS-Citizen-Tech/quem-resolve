# Banco de dados: guia rápido para o parceiro

> 12/11/2026 · Ian · vale para o RPA (01), Quântica (03), Governança (06) e o RAG (05).

O projeto agora tem um banco **Postgres no Supabase**. Resumo do que muda para você: **nada é obrigatório.** A API continua com os mesmos endpoints (`CONTRATOS.md` v0.9). O banco só abre um caminho extra, por SQL, para os relatórios e para o robô.

## 1. Como entrar

- O Ian te convidou como **membro do projeto no Supabase** (chega por e-mail). Você vê as tabelas no painel (Table Editor e SQL Editor) com a sua conta. **Ninguém manda senha por mensagem.**
- Para conectar de um script (Python, UiPath, Power BI), use o usuário **só de leitura** `qr_leitor`. A senha o Ian te passa por um canal seguro (pessoalmente ou num gerenciador de senhas). No Supabase o nome do usuário na conexão fica `qr_leitor.<id-do-projeto>`, no host do "Session pooler" (Project Settings > Database).
- Guarde a conexão numa variável de ambiente (`.env`), **nunca no código nem no Git**.

## 2. O que o `qr_leitor` pode fazer

Tudo fica no schema `relatorios` (a API REST pública do Supabase não enxerga esse schema):

| Visão / tabela | Para quê | Pode |
|---|---|---|
| `vw_pendentes_envio` | Fila do robô de e-mail: protocolo, categoria, descrição, órgão, canal e contato | ler |
| `rpa_execucoes` | Log de cada rodada do robô: `inicio`, `fim`, `enviados`, `falhas`, `motivo`, `robo` | ler, inserir e atualizar |
| `vw_ocorrencias_resumo` | Ocorrências com nomes, **sem descrição** e com local arredondado (~100 m) | ler |
| `vw_por_orgao_mes` | Por órgão e mês: total, resolvidas, % corrigida pelo cidadão e pelo gestor, horas até "enviada" | ler |
| `vw_frota_cobertura` | Por linha de ônibus: passagens, detecções, "possivelmente resolvidas" | ler |
| `vw_carga_frota` | Por passagem: duração, detecções, FPS, pontos de GPS (entrada do iSPD) | ler |
| `vw_guardrail_semana` | Acionamentos do guardrail por semana e nível (só contagem) | ler |

As tabelas da API (`public.ocorrencias`, `gestores`...) ficam **fora do alcance** do `qr_leitor`, de propósito (LGPD e segurança).

A coluna `simulada` (ou `tem_simulada`) separa os 120 exemplos da demonstração dos reportes de verdade. Para relatórios sérios, filtre `where not simulada`.

## 3. Robô de RPA (sugestão)

1. Abre uma linha: `insert into rpa_execucoes default values returning id`.
2. Lê `select * from vw_pendentes_envio order by prioridade desc, criada_em`.
3. Para cada uma, manda o e-mail e marca pela **API**: `PATCH /ocorrencias/{id}/status` com `{"status": "enviada", "observacao": "..."}` e o cabeçalho `X-Robo-Chave`. (Pela API, a mudança entra no histórico com "Robô RPA".)
4. Fecha a linha: `update rpa_execucoes set fim = now(), enviados = 7, falhas = 1, motivo = 'SMTP recusou 1' where id = ...`.

Se o banco ou a API caírem, o robô para sem mudar nada (caminho seguro). O log mostra isso.

## 4. RAG com pgvector

O Supabase já tem a extensão `vector`. Quando quiser levar o RAG para o banco, crie a sua migração em `api/app/db/migracoes/` com o próximo número (ex.: `008_rag.sql`), por exemplo:

```sql
create extension if not exists vector;
create table rag_trechos (
  id bigint generated always as identity primary key,
  fonte text not null, url text, trecho text not null,
  embedding vector(768)          -- ajuste ao tamanho do seu modelo de embedding
);
alter table rag_trechos enable row level security;
```

A API aplica a migração sozinha na próxima subida. Dúvida no formato? Veja as que já existem (`001` a `007`): é SQL puro.

## 5. Regras

- Nada de texto, foto ou local de **emergência** no banco (só a contagem anônima, D08).
- Fotos e descrições somem **90 dias depois** de a ocorrência ser resolvida (`python -m app.db.limpeza`).
- Antes do vídeo e da entrega, o Ian roda o backup (`python -m app.db.backup`).

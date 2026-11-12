-- Ocorrências (contrato E, v0.8) e o histórico de cada mudança (human-in-the-loop do gestor, robô e ônibus).
create table ocorrencias (
  id                      uuid primary key,
  protocolo               text not null unique,
  criada_em               timestamptz not null,
  descricao               text not null,
  lat                     double precision not null,
  lon                     double precision not null,
  categoria_sugerida      text,
  confianca               real not null default 0 check (confianca between 0 and 1),
  categoria_final         text not null references categorias (id),
  responsavel_id          text not null references responsaveis (id),
  corrigida_pelo_cidadao  boolean not null default false,
  corrigida_pelo_gestor   boolean not null default false,
  status                  text not null check (status in ('pendente_envio', 'enviada', 'possivelmente_resolvida', 'resolvida')),
  prioridade              smallint not null check (prioridade between 1 and 5),
  origem                  text not null check (origem in ('cidadao', 'frota', 'ambos')),
  grupo_duplicata_id      uuid,
  foto_path               text,                    -- caminho no Storage privado (foto já borrada), nunca a foto
  simulada                boolean not null default false,  -- dados de exemplo da demonstração (RF34)
  atualizada_em           timestamptz not null default now()
);
create index ocorrencias_orgao_status on ocorrencias (responsavel_id, status);
create index ocorrencias_categoria on ocorrencias (categoria_final);
create index ocorrencias_grupo on ocorrencias (grupo_duplicata_id);
create index ocorrencias_criada on ocorrencias (criada_em desc);
create index ocorrencias_lugar on ocorrencias (lat, lon);  -- busca de duplicata (50 m) e "possivelmente resolvida" (25 m)

-- Quem mudou o quê. quem = usuário do gestor, "robo-rpa" ou "onibus:<linha>".
create table historico_ocorrencia (
  id             bigint generated always as identity primary key,
  ocorrencia_id  uuid not null references ocorrencias (id) on delete cascade,
  em             timestamptz not null default now(),
  quem           text not null,
  campo          text not null check (campo in ('status', 'categoria')),
  de             text,
  para           text,
  observacao     text
);
create index historico_ocorrencia_id on historico_ocorrencia (ocorrencia_id, em);

-- Frota (contrato I): cada passagem de ônibus e cada detecção, ligada à ocorrência que ela gerou ou reforçou.
create table passagens_frota (
  id                        uuid primary key,
  linha_onibus              text not null,
  inicio                    timestamptz not null,
  fim                       timestamptz not null,
  trajeto                   jsonb not null,        -- [[lat, lon], ...]
  deteccoes                 integer not null default 0,
  fps                       real,
  possivelmente_resolvidas  integer not null default 0,
  simulada                  boolean not null default false,
  recebida_em               timestamptz not null default now()
);
create index passagens_inicio on passagens_frota (inicio desc);

create table deteccoes_frota (
  id             bigint generated always as identity primary key,
  passagem_id    uuid not null references passagens_frota (id) on delete cascade,
  detectada_em   timestamptz not null,
  lat            double precision not null,
  lon            double precision not null,
  classe         text not null,
  categoria_id   text,
  confianca      real not null,
  bbox           jsonb,                  -- [x1, y1, x2, y2] normalizado; vazio quando não há caixa
  recorte_path   text,                   -- caminho do recorte já borrado no Storage (o vídeo bruto nunca chega aqui)
  ocorrencia_id  uuid references ocorrencias (id) on delete set null
);
create index deteccoes_passagem on deteccoes_frota (passagem_id);
create index deteccoes_ocorrencia on deteccoes_frota (ocorrencia_id);

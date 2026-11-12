-- Medições anônimas: nenhuma tabela aqui guarda texto, foto, áudio, localização ou identificador de pessoa.

-- OuviAí (IoT).
create table eventos_som (
  id           uuid primary key,
  classe       text not null check (classe in ('sirene', 'buzina', 'ambiente')),
  confianca    real not null,
  dispositivo  text not null,
  recebido_em  timestamptz not null,
  alerta       boolean not null,
  mensagem     text not null
);
create index eventos_som_recebido on eventos_som (recebido_em desc);

-- "Isso ajudou?" (contrato L).
create table feedbacks (
  id           uuid primary key,
  recebido_em  timestamptz not null,
  alvo         text not null check (alvo in ('reporte', 'assistente')),
  alvo_id      text not null,
  util         boolean not null,
  comentario   text
);

-- Guardrail (D08): só a contagem por dia, nível, tipo e camada.
create table guardrail_registros (
  data              date not null,
  nivel             smallint not null,
  tipo              text not null default '',
  camada            text not null default '',
  nao_e_emergencia  boolean not null default false,
  total             integer not null default 0,
  primary key (data, nivel, tipo, camada, nao_e_emergencia)
);

-- Visão (foto do cidadão): latência e quem respondeu, sem imagem.
create table visao_chamadas (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  latencia_ms  real not null,
  origem       text not null check (origem in ('yolo', 'multimodal', 'nenhuma'))
);

-- Voz (PLN, parceiro): latência de cada etapa, sem áudio e sem texto.
create table voz_latencias (
  id         bigint generated always as identity primary key,
  em         timestamptz not null default now(),
  stt_ms     real not null,
  llm_ms     real not null,
  tts_ms     real not null,
  total_ms   real not null,
  provedor   text not null          -- VOZ_PROVIDER no momento (para comparar 2 opções)
);

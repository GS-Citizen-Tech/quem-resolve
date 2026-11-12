-- B3: tudo o que o robô de RPA e os relatórios (Governança/BA, Quântica, Cluster, VC) leem por SQL.
-- Fica num schema próprio, "relatorios", que a API REST do Supabase NÃO publica (só "public" é publicado).
-- Por isso as visões podem ler as tabelas (o dono delas é o mesmo) sem abrir nada para a internet.
create schema if not exists relatorios;
revoke all on schema relatorios from public;

-- Log do robô de RPA (disciplina 01): cada rodada, com resultado. O robô grava aqui com o usuário qr_leitor.
create table relatorios.rpa_execucoes (
  id          bigint generated always as identity primary key,
  inicio      timestamptz not null default now(),
  fim         timestamptz,
  enviados    integer not null default 0,
  falhas      integer not null default 0,
  motivo      text,                      -- ex.: "SMTP fora do ar"; nunca dado do cidadão
  robo        text not null default 'robo-email'
);

-- Ocorrência com nomes, sem a descrição e com o local arredondado (~100 m): pode ir para um painel.
create view relatorios.vw_ocorrencias_resumo as
select o.id, o.protocolo, o.criada_em, o.categoria_final as categoria_id, c.nome as categoria,
       o.responsavel_id, r.nome as responsavel, o.status, o.prioridade, o.origem, o.confianca,
       o.corrigida_pelo_cidadao, o.corrigida_pelo_gestor, o.grupo_duplicata_id is not null as duplicata,
       o.foto_path is not null as tem_foto, round(o.lat::numeric, 3) as lat_aprox, round(o.lon::numeric, 3) as lon_aprox,
       o.simulada
from ocorrencias o
join categorias c on c.id = o.categoria_final
join responsaveis r on r.id = o.responsavel_id;

-- Fila do robô de e-mail: o que ainda não foi enviado, com o canal do órgão. Aqui a descrição vai junto
-- (é o texto da solicitação oficial). Sem foto e sem coordenada exata.
create view relatorios.vw_pendentes_envio as
select o.id, o.protocolo, o.criada_em, c.nome as categoria, o.descricao, o.prioridade,
       round(o.lat::numeric, 4) as lat, round(o.lon::numeric, 4) as lon,
       r.id as responsavel_id, r.nome as responsavel, r.canal, r.contato, r.url
from ocorrencias o
join categorias c on c.id = o.categoria_final
join responsaveis r on r.id = o.responsavel_id
where o.status = 'pendente_envio' and not o.simulada;

-- Por órgão e mês: volume, correções (IA errou) e tempo até "enviada" (Governança/BA).
create view relatorios.vw_por_orgao_mes as
with enviada as (
  select ocorrencia_id, min(em) as em from historico_ocorrencia where campo = 'status' and para = 'enviada' group by 1
)
select date_trunc('month', o.criada_em)::date as mes, o.responsavel_id, r.nome as responsavel,
       o.responsavel_id not in ('subprefeitura', 'prefeitura', 'cet', 'proprietario', 'concessionaria_coleta') as fora_da_prefeitura,
       count(*) as total,
       count(*) filter (where o.status = 'resolvida') as resolvidas,
       round(100.0 * avg(o.corrigida_pelo_cidadao::int), 1) as pct_corrigida_cidadao,
       round(100.0 * avg(o.corrigida_pelo_gestor::int), 1) as pct_corrigida_gestor,
       round((avg(extract(epoch from e.em - o.criada_em)) / 3600)::numeric, 1) as horas_ate_enviada,
       bool_or(o.simulada) as tem_simulada
from ocorrencias o
join responsaveis r on r.id = o.responsavel_id
left join enviada e on e.ocorrencia_id = o.id
group by 1, 2, 3;

-- Frota por linha de ônibus (VC e Quântica: cobertura das rotas).
create view relatorios.vw_frota_cobertura as
select linha_onibus, count(*) as passagens, sum(deteccoes) as deteccoes,
       sum(possivelmente_resolvidas) as possivelmente_resolvidas,
       min(inicio) as primeira, max(inicio) as ultima, round(avg(fps)::numeric, 1) as fps_medio
from passagens_frota group by 1;

-- Carga de cada passagem (entrada do simulador iSPD, disciplina 02): duração, detecções e FPS medido.
create view relatorios.vw_carga_frota as
select id as passagem_id, linha_onibus, inicio, extract(epoch from fim - inicio)::int as duracao_s,
       deteccoes, fps, jsonb_array_length(trajeto) as pontos_gps, simulada
from passagens_frota;

-- Guardrail por semana e nível (só contagens, D08).
create view relatorios.vw_guardrail_semana as
select date_trunc('week', data)::date as semana, nivel, sum(total) as total,
       sum(total) filter (where nao_e_emergencia) as nao_e_emergencia
from guardrail_registros group by 1, 2;

-- No Supabase existem os papéis da API REST (anon, authenticated): garantimos que eles não leem nada daqui.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema relatorios from anon, authenticated;
    revoke all on schema relatorios from anon, authenticated;
  end if;
end $$;

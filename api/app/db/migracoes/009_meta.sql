-- v1.3: anotações da própria API (ex.: qual versão dos dados de exemplo está no banco).
-- Com isso a API troca a simulação antiga sozinha na subida, sem script manual.
create table if not exists meta_app (
  chave text primary key,
  valor text not null,
  atualizada_em timestamptz not null default now()
);
alter table meta_app enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on meta_app from anon, authenticated;
  end if;
end $$;

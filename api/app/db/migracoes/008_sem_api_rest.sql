-- Reforço (verificador de segurança do Supabase, 12/11): o RLS sem política já bloqueia as linhas pela API REST
-- do Supabase, mas os papéis anon/authenticated ainda tinham permissão nas tabelas (padrão do Supabase).
-- Tiramos a permissão também: duas trancas. A API FastAPI conecta como dona das tabelas e não muda nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;

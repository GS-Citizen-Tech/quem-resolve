-- Supabase publica as tabelas numa API REST própria. Nosso acesso é só pela API FastAPI (conexão direta),
-- então ligamos o RLS sem nenhuma política: pela API REST do Supabase, ninguém lê nem escreve nada.
-- (No Postgres comum isso não muda nada para a API, que conecta como dona das tabelas.)
alter table responsaveis enable row level security;
alter table categorias enable row level security;
alter table ocorrencias enable row level security;
alter table historico_ocorrencia enable row level security;
alter table passagens_frota enable row level security;
alter table deteccoes_frota enable row level security;
alter table eventos_som enable row level security;
alter table feedbacks enable row level security;
alter table guardrail_registros enable row level security;
alter table visao_chamadas enable row level security;
alter table voz_latencias enable row level security;
alter table gestores enable row level security;

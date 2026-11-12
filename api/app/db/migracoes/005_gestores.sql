-- Logins do console. Senha só como hash bcrypt. O GESTORES do .env é a semente da primeira subida.
create table gestores (
  usuario     text primary key,
  nome        text not null,
  orgao_id    text not null references responsaveis (id),
  senha_hash  text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Base "Quem resolve o quê". A fonte versionada continua sendo api/app/data/quem_resolve.json (RF32):
-- a API copia o JSON para cá na subida, para as consultas e visões SQL terem os nomes.
create table responsaveis (
  id       text primary key,
  nome     text not null,
  canal    text,
  contato  text,
  url      text
);

create table categorias (
  id              text primary key,
  nome            text not null,
  responsavel_id  text not null references responsaveis (id),
  emergencia      text not null check (emergencia in ('sim', 'nao', 'depende')),
  classes_visao   text[] not null default '{}'
);

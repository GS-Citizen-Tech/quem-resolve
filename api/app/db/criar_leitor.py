"""Cria (ou atualiza a senha de) o usuário só de leitura "qr_leitor", para o robô de RPA e os relatórios.

Rodar uma vez, dentro de api/, com o DATABASE_URL do dono no .env e a senha nova numa variável:
    set LEITOR_SENHA=uma-senha-forte        (Windows)    |   export LEITOR_SENHA=...   (Linux/Mac)
    .venv\\Scripts\\python -m app.db.criar_leitor
O que ele pode: ler as visões do schema "relatorios" e gravar o log do robô (relatorios.rpa_execucoes).
O que ele NÃO pode: ler ou mudar as tabelas da API (ocorrências, gestores, fotos...).
A senha nunca vai para o Git nem para o chat: passe ao parceiro por um canal seguro."""
import os
import re

from sqlalchemy import text

from app import config


def criar(senha: str) -> None:
    from app.db import postgres
    if not re.fullmatch(r"[A-Za-z0-9_\-!@#%^*.,+=]{12,}", senha):
        raise SystemExit("Use uma senha com 12+ caracteres (letras, números e _-!@#%^*.,+=).")
    with postgres.motor().begin() as c:
        existe = c.execute(text("select 1 from pg_roles where rolname = 'qr_leitor'")).first()
        acao = "alter" if existe else "create"
        c.exec_driver_sql(f"{acao} role qr_leitor with login password '{senha}'")  # validada acima: sem aspas
        for sql in (
            "grant usage on schema relatorios to qr_leitor",
            "grant select on all tables in schema relatorios to qr_leitor",
            "grant insert, update on relatorios.rpa_execucoes to qr_leitor",
            "grant usage on all sequences in schema relatorios to qr_leitor",
            "revoke all on all tables in schema public from qr_leitor",
            "alter role qr_leitor set search_path = relatorios",
            "alter default privileges in schema relatorios grant select on tables to qr_leitor",  # visões futuras
        ):
            c.exec_driver_sql(sql)
    print(f"qr_leitor {'atualizado' if existe else 'criado'}. No Supabase, o usuário da conexão fica qr_leitor.<id-do-projeto>.")


if __name__ == "__main__":
    if not config.DATABASE_URL:
        raise SystemExit("DATABASE_URL vazio no api/.env.")
    s = os.getenv("LEITOR_SENHA", "")
    if not s:
        raise SystemExit("Defina LEITOR_SENHA antes (ver o topo deste arquivo).")
    criar(s)

"""Aplica as migrações SQL de app/db/migracoes/ em ordem, uma vez cada (tabela schema_migracoes).
Roda sozinho na subida da API. Manual: python -m app.db.migrar (usa o DATABASE_URL do .env)."""
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

PASTA = Path(__file__).resolve().parent / "migracoes"
_TRAVA = 4815162342  # advisory lock: duas APIs subindo juntas não aplicam a mesma migração duas vezes


def pendentes(c: Connection) -> list[Path]:
    c.execute(text("""create table if not exists schema_migracoes (
                        nome text primary key, aplicada_em timestamptz not null default now())"""))
    c.execute(text("alter table schema_migracoes enable row level security"))
    feitas = {x[0] for x in c.execute(text("select nome from schema_migracoes"))}
    return [p for p in sorted(PASTA.glob("*.sql")) if p.name not in feitas]


def aplicar(c: Connection) -> list[str]:
    """Dentro da transação de quem chamou: se uma migração falhar, nenhuma desta rodada fica pela metade."""
    c.execute(text("select pg_advisory_xact_lock(:k)"), {"k": _TRAVA})
    feitas = []
    for p in pendentes(c):
        c.exec_driver_sql(p.read_text(encoding="utf-8"))
        c.execute(text("insert into schema_migracoes (nome) values (:n)"), {"n": p.name})
        feitas.append(p.name)
    return feitas


if __name__ == "__main__":
    from app.db import postgres
    from app import config
    if not config.DATABASE_URL:
        raise SystemExit("DATABASE_URL vazio no api/.env: sem banco, a API usa a memória.")
    with postgres.motor().begin() as conexao:
        print("Aplicadas:", aplicar(conexao) or "nenhuma (já estava em dia)")

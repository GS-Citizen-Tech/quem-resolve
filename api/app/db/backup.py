"""Cópia de segurança do banco em JSON (o plano grátis do Supabase não tem backup que dê para baixar).
Rodar dentro de api/ antes de gravar o vídeo e antes da entrega:   python -m app.db.backup
Sai em api/backups/AAAA-MM-DD_HHMM/<tabela>.jsonl (a pasta backups/ não vai para o Git: tem hash de senha).
As fotos ficam no Storage; o backup guarda só o caminho delas."""
import json
from datetime import datetime
from pathlib import Path

from app import config


def rodar(pasta: Path | None = None) -> Path:
    from app.db import postgres
    destino = pasta or Path(__file__).resolve().parents[2] / "backups" / datetime.now().strftime("%Y-%m-%d_%H%M")
    destino.mkdir(parents=True, exist_ok=True)
    for t in postgres.TABELAS_BACKUP:
        n = 0
        with open(destino / f"{t}.jsonl", "w", encoding="utf-8") as f:
            for linha in postgres.exportar(t):
                f.write(json.dumps(linha, default=str, ensure_ascii=False) + "\n")
                n += 1
        print(f"{t}: {n}")
    return destino


if __name__ == "__main__":
    if not config.DATABASE_URL:
        raise SystemExit("DATABASE_URL vazio no api/.env.")
    print("Backup em", rodar())

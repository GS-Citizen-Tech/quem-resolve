"""Retenção (LGPD, decisão 4 do PLANO-BANCO): 90 dias depois de a ocorrência ser RESOLVIDA, apaga a foto e os
recortes do Storage e troca a descrição por um aviso. Os números (categoria, órgão, datas) ficam para as estatísticas.
Também apaga eventos de som com mais de 90 dias.

Rodar dentro de api/:   python -m app.db.limpeza --simular   (só mostra)   |   python -m app.db.limpeza   (apaga)
Prazo: RETENCAO_DIAS no .env (padrão 90). Pode ir num agendador (Agendador de Tarefas do Windows, cron, Render Cron)."""
import argparse

from app import config
from app.providers import armazenamento


def rodar(dias: int, simular: bool = False) -> dict:
    from app.db import postgres
    alvos = postgres.vencidas(dias)
    caminhos = [a["foto_path"] for a in alvos] + [r for a in alvos for r in a["recortes"]]
    if simular or not alvos:
        return {"ocorrencias": len(alvos), "fotos": len([c for c in caminhos if c]), "simulado": simular}
    armazenamento.apagar(caminhos)  # primeiro o Storage: se falhar, o banco fica como estava e roda de novo depois
    feito = postgres.apagar_dados_vencidos([a["id"] for a in alvos], dias)
    return {**feito, "fotos": len([c for c in caminhos if c]), "simulado": False}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dias", type=int, default=config.RETENCAO_DIAS)
    ap.add_argument("--simular", action="store_true", help="só conta o que seria apagado")
    a = ap.parse_args()
    if not config.DATABASE_URL:
        raise SystemExit("Sem DATABASE_URL a API está em memória: não há nada guardado para limpar.")
    print(rodar(a.dias, a.simular))

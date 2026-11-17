"""Traçado real de linhas de ônibus da SPTrans (v1.5; 12 linhas desde a v1.6), tirado do GTFS oficial (shapes.txt) e guardado já simplificado
em app/data/linhas_onibus.json. Os danos e as passagens da frota continuam simulados; só o caminho é real.

- 3789-10 Cid. Tiradentes - Metrô Itaquera: últimos 4 km (simulação da frota, zona leste)
- 8000-10 Term. Lapa - Pça. Ramos de Azevedo: linha inteira (simulação da frota)
- 875A-10 Aeroporto - Perdizes: trecho da Av. Paulista (trajeto do "Analisar vídeo" sem GPX)
- v1.6: mais 9 linhas, ~5 km de cada, uma por região (São Mateus, Brasilândia, Capão Redondo, Santana, Penha,
  Jabaquara, Butantã, Mooca, Vila Prudente), para a simulação da frota (simulacao.LINHAS_EXTRAS).
"""
import json
import math
from functools import lru_cache
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "linhas_onibus.json"
LINHA_VIDEO = "875A-10"  # passa na Av. Paulista


@lru_cache
def _dados() -> dict:
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


def fonte() -> str:
    return _dados()["fonte"]


def linha(codigo: str) -> dict:
    for item in _dados()["linhas"]:
        if item["codigo"] == codigo:
            return item
    raise KeyError(f"Linha {codigo} não está em {ARQUIVO.name}")


def pontos(codigo: str) -> list[tuple[float, float]]:
    return [(lat, lon) for lat, lon in linha(codigo)["pontos"]]


def _dist(a, b) -> float:
    return math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0])))


def reamostrar(caminho: list[tuple[float, float]], n: int) -> list[tuple[float, float]]:
    """n pontos igualmente espaçados ao longo do caminho (para posicionar danos e interpolar o GPS)."""
    trechos = [_dist(caminho[i], caminho[i + 1]) for i in range(len(caminho) - 1)]
    total = sum(trechos)
    saida, i, andado = [], 0, 0.0
    for k in range(n):
        alvo = total * k / (n - 1)
        while i < len(trechos) - 1 and andado + trechos[i] < alvo:
            andado += trechos[i]
            i += 1
        f = 0.0 if trechos[i] == 0 else min(1.0, (alvo - andado) / trechos[i])
        a, b = caminho[i], caminho[i + 1]
        saida.append((round(a[0] + (b[0] - a[0]) * f, 6), round(a[1] + (b[1] - a[1]) * f, 6)))
    return saida

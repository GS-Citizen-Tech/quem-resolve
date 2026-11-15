"""Os 96 distritos de São Paulo (malha oficial do IBGE, contrato O v1.3): em qual distrito cai cada ponto.

A API baixa a malha do IBGE sozinha na primeira vez que sobe (garantir) e guarda em app/data/distritos_sp.geojson;
das próximas vezes só lê o arquivo. Se o IBGE estiver fora do ar, tudo continua funcionando (distrito vazio) e a
API tenta de novo quando o mapa pedir a malha, no máximo a cada 2 minutos.
Ponto-no-polígono feito aqui (raio cruzando as arestas), sem biblioteca de geografia.
"""
import json
import logging
import threading
import time
from functools import lru_cache
from pathlib import Path

from app import config
from app.providers import malha_ibge

log = logging.getLogger("quem-resolve")

ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "distritos_sp.geojson"


def _aneis(geometria: dict) -> list[list[list[list[float]]]]:
    """Lista de polígonos; cada polígono = [contorno, buracos...]."""
    if geometria["type"] == "Polygon":
        return [geometria["coordinates"]]
    return geometria["coordinates"]


def _caixa(poligonos) -> tuple[float, float, float, float]:
    xs = [p[0] for pol in poligonos for p in pol[0]]
    ys = [p[1] for pol in poligonos for p in pol[0]]
    return min(xs), min(ys), max(xs), max(ys)


def _dentro_anel(x: float, y: float, anel) -> bool:
    dentro = False
    j = len(anel) - 1
    for i in range(len(anel)):
        xi, yi = anel[i]
        xj, yj = anel[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def _dentro(x: float, y: float, poligonos) -> bool:
    for contorno, *buracos in poligonos:
        if _dentro_anel(x, y, contorno) and not any(_dentro_anel(x, y, b) for b in buracos):
            return True
    return False


@lru_cache(maxsize=1)
def _carregar(caminho: str) -> tuple[dict, list[tuple[str, str, tuple, list]]]:
    p = Path(caminho)
    if not p.exists():
        return {"type": "FeatureCollection", "features": []}, []
    dados = json.loads(p.read_text(encoding="utf-8"))
    indice = []
    for f in dados["features"]:
        pol = _aneis(f["geometry"])
        indice.append((f["properties"]["id"], f["properties"]["nome"], _caixa(pol), pol))
    return dados, indice


def _arquivo() -> str:
    return config.DISTRITOS_ARQUIVO or str(ARQUIVO)


def geojson() -> dict:
    return _carregar(_arquivo())[0]


def lista() -> list[tuple[str, str]]:
    """[(id, nome)] em ordem alfabética."""
    return [(i, n) for i, n, _, _ in _carregar(_arquivo())[1]]


@lru_cache(maxsize=20000)
def distrito_de(lat: float, lon: float) -> str | None:
    """Id do distrito (ex.: "itaquera") ou None fora de São Paulo / sem a malha."""
    for i, _, (x0, y0, x1, y1), pol in _carregar(_arquivo())[1]:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and _dentro(lon, lat, pol):
            return i
    return None


_trava = threading.Lock()
_ultima_tentativa = 0.0
ESPERA_ENTRE_TENTATIVAS = 120  # segundos


def garantir() -> bool:
    """Baixa a malha do IBGE se o arquivo padrão ainda não existe. True = malha disponível.
    Só baixa no arquivo padrão (DISTRITOS_ARQUIVO vazio) e com DISTRITOS_BAIXAR ligado. Chamadas ao mesmo
    tempo esperam a primeira terminar (não baixa duas vezes)."""
    global _ultima_tentativa
    if Path(_arquivo()).exists():
        if not _carregar(_arquivo())[1]:
            recarregar()  # o arquivo apareceu depois da 1ª leitura (cópia manual com a API no ar)
        return True
    if config.DISTRITOS_ARQUIVO or not config.DISTRITOS_BAIXAR:
        return False
    with _trava:
        if ARQUIVO.exists():
            recarregar()
            return True
        if time.monotonic() - _ultima_tentativa < ESPERA_ENTRE_TENTATIVAS and _ultima_tentativa:
            return False
        _ultima_tentativa = time.monotonic()
        try:
            dados = malha_ibge.montar(timeout=30, avisar=log.info)
            malha_ibge.salvar(dados, ARQUIVO)
        except (malha_ibge.ErroMalha, OSError) as e:
            log.warning("Bairros: não deu para baixar a malha do IBGE (%s). O mapa segue só com os pontos.", e)
            return False
        recarregar()
        log.info("Bairros: %s distritos do IBGE salvos em %s.", len(dados["features"]), ARQUIVO)
        return True


def garantir_em_segundo_plano() -> None:
    """Na subida da API: baixa sem atrasar a subida."""
    if not Path(_arquivo()).exists():
        threading.Thread(target=garantir, name="malha-ibge", daemon=True).start()


def recarregar() -> None:
    """Testes: troca de arquivo."""
    _carregar.cache_clear()
    distrito_de.cache_clear()

"""Malha oficial dos 96 distritos de São Paulo (IBGE, dado aberto, contrato O v1.3): baixa e simplifica.

Usado pela API sozinha (app/providers/distritos.py baixa na primeira vez que sobe e guarda em
app/data/distritos_sp.geojson) e pelo script manual scripts/baixar_distritos.py.

Fontes (API pública de serviços de dados do IBGE):
- malha:  /api/v3/malhas/municipios/3550308?intrarregiao=distrito  (polígonos, código de cada distrito)
- nomes:  /api/v1/localidades/municipios/3550308/distritos
Só usa a biblioteca padrão do Python.
"""
import json
from pathlib import Path
import math
import unicodedata
import urllib.request

MUNICIPIO = "3550308"  # São Paulo
URL_MALHA = (f"https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{MUNICIPIO}"
             "?formato=application/vnd.geo%2Bjson&intrarregiao=distrito&qualidade=maxima")
URL_NOMES = f"https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{MUNICIPIO}/distritos"
TOLERANCIA = 0.00025  # ~25 m: fronteira continua certa no zoom de cidade e de bairro


def baixar(url: str, timeout: float = 60):
    req = urllib.request.Request(url, headers={"User-Agent": "QuemResolve/1.3 (projeto academico FIAP)",
                                               "Accept": "application/json, application/vnd.geo+json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def slug(nome: str) -> str:
    t = unicodedata.normalize("NFKD", nome.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return "-".join("".join(c if c.isalnum() else " " for c in t).split())


def _dist(p, a, b):
    if a == b:
        return math.dist(p, a)
    (x, y), (x1, y1), (x2, y2) = p, a, b
    return abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / math.dist(a, b)


def simplificar(pontos, tol):
    """Douglas-Peucker (iterativo)."""
    if len(pontos) < 5:
        return pontos
    manter = [False] * len(pontos)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pontos) - 1)]
    while pilha:
        i, j = pilha.pop()
        maior, k = 0.0, -1
        for n in range(i + 1, j):
            d = _dist(pontos[n], pontos[i], pontos[j])
            if d > maior:
                maior, k = d, n
        if maior > tol:
            manter[k] = True
            pilha += [(i, k), (k, j)]
    r = [p for p, m in zip(pontos, manter) if m]
    return r if len(r) >= 4 else pontos


def anel(a):
    return [[round(x, 5), round(y, 5)] for x, y in simplificar(a, TOLERANCIA)]


def geometria(g):
    if g["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [anel(a) for a in g["coordinates"]]}
    if g["type"] == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [[anel(a) for a in p] for p in g["coordinates"]]}
    raise ValueError(f"Geometria inesperada: {g['type']}")


class ErroMalha(Exception):
    """IBGE fora do ar, lento ou com resposta inesperada."""


def montar(timeout: float = 60, avisar=lambda _m: None) -> dict:
    """Baixa nomes e malha e devolve o GeoJSON pronto (id = slug do nome). Levanta ErroMalha."""
    try:
        avisar("Baixando nomes dos distritos do IBGE…")
        nomes = {str(d["id"]): d["nome"] for d in baixar(URL_NOMES, timeout)}
        avisar("Baixando malha dos distritos do IBGE…")
        malha = baixar(URL_MALHA, timeout)
    except Exception as e:  # noqa: BLE001 - rede, HTTP ou JSON: tudo vira "IBGE indisponível"
        raise ErroMalha(f"IBGE indisponível: {e.__class__.__name__}: {e}") from e
    feats = []
    for f in malha.get("features", []):
        cod = str(f["properties"].get("codarea"))
        nome = nomes.get(cod)
        if not nome:
            avisar(f"código {cod} sem nome, ignorado")
            continue
        feats.append({"type": "Feature", "properties": {"id": slug(nome), "nome": nome, "codigo_ibge": cod},
                      "geometry": geometria(f["geometry"])})
    feats.sort(key=lambda f: f["properties"]["nome"])
    if len(feats) < 90:
        raise ErroMalha(f"Só vieram {len(feats)} distritos do IBGE; esperado 96.")
    return {"type": "FeatureCollection",
            "fonte": "IBGE, malha de distritos do município de São Paulo (3550308), simplificada ~25 m",
            "features": feats}


def salvar(dados: dict, caminho: Path) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(caminho)  # nunca deixa um arquivo pela metade

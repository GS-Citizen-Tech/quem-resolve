"""Endereço por extenso a partir das coordenadas (e o caminho inverso), contrato O (v1.1).

Fonte: OpenStreetMap / Nominatim (grátis, sem chave). A chamada sai da API, nunca do aparelho:
- User-Agent do projeto (exigência do Nominatim);
- no máximo 1 pedido por segundo (política de uso);
- cache em memória com as coordenadas arredondadas (~10 m), para não repetir a mesma pergunta.

`GEO_PROVIDER=mock` devolve endereços fixos (testes e demonstração sem internet).
"""
import threading
import time
from collections import OrderedDict
from typing import Protocol

from app import config
from app.schemas.geo import Endereco, ResultadoBusca

# Caixa da Grande São Paulo (a mesma de schemas.base.Localizacao).
LAT_MIN, LAT_MAX, LON_MIN, LON_MAX = -24.1, -23.3, -47.0, -46.3


class ErroGeo(Exception):
    """OpenStreetMap fora do ar, lento ou com resposta que não deu para ler."""


class Geo(Protocol):
    nome: str

    def endereco(self, lat: float, lon: float) -> Endereco | None: ...

    def buscar(self, texto: str) -> list[ResultadoBusca]: ...


class _Cache:
    def __init__(self, tamanho: int = 2000):
        self.dados: OrderedDict = OrderedDict()
        self.tamanho = tamanho
        self.trava = threading.Lock()

    def pegar(self, chave):
        with self.trava:
            if chave in self.dados:
                self.dados.move_to_end(chave)
                return True, self.dados[chave]
            return False, None

    def guardar(self, chave, valor):
        with self.trava:
            self.dados[chave] = valor
            self.dados.move_to_end(chave)
            while len(self.dados) > self.tamanho:
                self.dados.popitem(last=False)


def _texto_curto(rua: str | None, numero: str | None, alternativa: str | None) -> str:
    if rua and numero:
        return f"{rua}, {numero}"
    return rua or alternativa or "Local marcado no mapa"


class MockGeo:
    """Endereços fixos: o ponto mais perto de uma lista curta de lugares conhecidos de SP."""

    nome = "mock"
    LUGARES = [
        ("Rua Augusta", "900", "Consolação", -23.5558, -46.6623),
        ("Avenida Paulista", "1578", "Bela Vista", -23.5614, -46.6559),
        ("Praça da Sé", None, "Sé", -23.5503, -46.6340),
        ("Rua Voluntários da Pátria", "2100", "Santana", -23.5032, -46.6253),
        ("Avenida Sapopemba", "5000", "Sapopemba", -23.5981, -46.5232),
    ]

    def endereco(self, lat: float, lon: float) -> Endereco | None:
        rua, numero, bairro, _, _ = min(self.LUGARES, key=lambda l: (l[3] - lat) ** 2 + (l[4] - lon) ** 2)
        return Endereco(texto_curto=_texto_curto(rua, numero, None), rua=rua, numero=numero, bairro=bairro,
                        cidade="São Paulo", fonte="OpenStreetMap (simulado)")

    def buscar(self, texto: str) -> list[ResultadoBusca]:
        t = texto.lower()
        achados = [l for l in self.LUGARES if any(p in l[0].lower() for p in t.split() if len(p) > 3)]
        return [ResultadoBusca(texto_curto=_texto_curto(r, n, None), bairro=b, cidade="São Paulo", lat=la, lon=lo)
                for r, n, b, la, lo in achados[:5]]


class NominatimGeo:
    nome = "nominatim"

    def __init__(self, url: str | None = None, transporte=None):
        self.url = (url or config.GEO_URL).rstrip("/")
        self.transporte = transporte  # httpx.MockTransport nos testes
        self.cache = _Cache()
        self.trava = threading.Lock()
        self.ultimo = 0.0

    def _pedir(self, caminho: str, params: dict):
        import httpx

        with self.trava:  # 1 pedido por segundo para o servidor público
            espera = 1.0 - (time.monotonic() - self.ultimo)
            if espera > 0:
                time.sleep(espera)
            self.ultimo = time.monotonic()
        try:
            with httpx.Client(transport=self.transporte, timeout=config.GEO_TIMEOUT,
                              headers={"User-Agent": config.GEO_USER_AGENT, "Accept-Language": "pt-BR"}) as c:
                r = c.get(f"{self.url}/{caminho}", params={**params, "format": "jsonv2", "addressdetails": 1})
                if r.status_code == 404:
                    return None
                r.raise_for_status()
                return r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise ErroGeo(e.__class__.__name__) from e

    @staticmethod
    def _montar(item: dict) -> tuple[str, str | None, str | None, str | None, str | None]:
        a = item.get("address") or {}
        rua = a.get("road") or a.get("pedestrian") or a.get("footway") or a.get("square")
        numero = a.get("house_number")
        bairro = a.get("suburb") or a.get("neighbourhood") or a.get("quarter") or a.get("city_district")
        cidade = a.get("city") or a.get("town") or a.get("municipality")
        alternativa = item.get("name") or (item.get("display_name") or "").split(",")[0] or None
        return _texto_curto(rua, numero, alternativa), rua, numero, bairro, cidade

    def endereco(self, lat: float, lon: float) -> Endereco | None:
        chave = ("rev", round(lat, 4), round(lon, 4))
        achou, valor = self.cache.pegar(chave)
        if achou:
            return valor
        dados = self._pedir("reverse", {"lat": f"{lat:.6f}", "lon": f"{lon:.6f}", "zoom": 18})
        if not dados or "error" in dados:
            valor = None
        else:
            texto, rua, numero, bairro, cidade = self._montar(dados)
            valor = Endereco(texto_curto=texto, rua=rua, numero=numero, bairro=bairro, cidade=cidade)
        self.cache.guardar(chave, valor)
        return valor

    def buscar(self, texto: str) -> list[ResultadoBusca]:
        chave = ("busca", " ".join(texto.lower().split()))
        achou, valor = self.cache.pegar(chave)
        if achou:
            return valor
        dados = self._pedir("search", {
            "q": texto, "limit": 5, "countrycodes": "br", "bounded": 1,
            "viewbox": f"{LON_MIN},{LAT_MAX},{LON_MAX},{LAT_MIN}",
        }) or []
        valor = []
        for item in dados:
            try:
                lat, lon = float(item["lat"]), float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                continue
            t, _, _, bairro, cidade = self._montar(item)
            valor.append(ResultadoBusca(texto_curto=t, bairro=bairro, cidade=cidade, lat=lat, lon=lon))
        self.cache.guardar(chave, valor)
        return valor


def _criar() -> Geo:
    return NominatimGeo() if config.GEO_PROVIDER == "nominatim" else MockGeo()


atual: Geo = _criar()

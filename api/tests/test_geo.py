"""Contrato O (v1.1): endereço por extenso."""
import httpx
import pytest

from app.providers import geocodificacao as geo


def test_endereco_mock(client):
    r = client.get("/geo/endereco", params={"lat": -23.5557, "lon": -46.6622})
    assert r.status_code == 200
    assert r.json()["texto_curto"] == "Rua Augusta, 900" and r.json()["bairro"] == "Consolação"


def test_endereco_fora_de_sp(client):
    assert client.get("/geo/endereco", params={"lat": -22.9, "lon": -43.2}).status_code == 422


def test_buscar_mock_e_validacao(client):
    r = client.get("/geo/buscar", params={"q": "paulista"})
    assert r.status_code == 200 and r.json()[0]["texto_curto"] == "Avenida Paulista, 1578"
    assert client.get("/geo/buscar", params={"q": "ab"}).status_code == 422


def _nominatim(resposta):
    pedidos = []

    def tratar(req: httpx.Request):
        pedidos.append(req)
        return resposta(req)

    g = geo.NominatimGeo(url="https://osm.teste", transporte=httpx.MockTransport(tratar))
    g.ultimo = -10  # sem a espera de 1 s no primeiro pedido
    return g, pedidos


def test_nominatim_reverso_com_cache(monkeypatch):
    g, pedidos = _nominatim(lambda req: httpx.Response(200, json={
        "name": "", "display_name": "900, Rua Augusta, Consolação, São Paulo",
        "address": {"road": "Rua Augusta", "house_number": "900", "suburb": "Consolação", "city": "São Paulo"}}))
    monkeypatch.setattr(geo.time, "sleep", lambda s: None)
    e = g.endereco(-23.55581, -46.66231)
    assert e.texto_curto == "Rua Augusta, 900" and e.bairro == "Consolação" and e.cidade == "São Paulo"
    g.endereco(-23.55582, -46.66232)  # mesmo ponto arredondado: vem do cache
    assert len(pedidos) == 1
    assert pedidos[0].headers["User-Agent"].startswith("QuemResolve")
    assert pedidos[0].url.path == "/reverse"


def test_nominatim_busca_filtra_fora_de_sp(monkeypatch):
    g, _ = _nominatim(lambda req: httpx.Response(200, json=[
        {"lat": "-23.5614", "lon": "-46.6559", "address": {"road": "Avenida Paulista", "house_number": "1578", "suburb": "Bela Vista", "city": "São Paulo"}},
        {"lat": "-22.9", "lon": "-43.2", "address": {"road": "Avenida Paulista"}},
    ]))
    monkeypatch.setattr(geo.time, "sleep", lambda s: None)
    r = g.buscar("avenida paulista 1578")
    assert [x.texto_curto for x in r] == ["Avenida Paulista, 1578"]


def test_nominatim_fora_do_ar_vira_503(client, monkeypatch):
    def cair(req):
        raise httpx.ConnectTimeout("lento")

    g, _ = _nominatim(cair)
    monkeypatch.setattr(geo, "atual", g)
    r = client.get("/geo/endereco", params={"lat": -23.55, "lon": -46.63})
    assert r.status_code == 503 and "endereço" in r.json()["detail"]


def test_nominatim_sem_endereco_vira_404(client, monkeypatch):
    g, _ = _nominatim(lambda req: httpx.Response(200, json={"error": "Unable to geocode"}))
    monkeypatch.setattr(geo, "atual", g)
    assert client.get("/geo/endereco", params={"lat": -23.9, "lon": -46.9}).status_code == 404

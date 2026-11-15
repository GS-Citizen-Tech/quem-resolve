"""v1.3: distritos (malha do IBGE), filtro por distrito e a simulação com pontos quentes."""
from pathlib import Path

import pytest

from app import config
from app.pipelines import simulacao
from app.providers import distritos, repositorio

MALHA = str(Path(__file__).parent / "fixtures" / "distritos_teste.geojson")


@pytest.fixture(autouse=True)
def malha_de_teste(monkeypatch):
    monkeypatch.setattr(config, "DISTRITOS_ARQUIVO", MALHA)
    distritos.recarregar()
    yield
    distritos.recarregar()


def test_ponto_no_poligono():
    assert distritos.distrito_de(-23.54, -46.46) == "itaquera"
    assert distritos.distrito_de(-23.555, -46.615) == "se"         # 2ª parte do MultiPolygon
    assert distritos.distrito_de(-23.65, -46.75) is None           # dentro do buraco
    assert distritos.distrito_de(-23.62, -46.78) == "buraco-no-meio"
    assert distritos.distrito_de(-23.40, -46.90) is None           # fora de tudo


def test_endpoints_de_distritos(client):
    assert [d["id"] for d in client.get("/geo/distritos").json()] == ["itaquera", "se", "buraco-no-meio"]
    r = client.get("/geo/distritos.geojson")
    assert r.status_code == 200 and len(r.json()["features"]) == 3 and "max-age" in r.headers["cache-control"]


def test_sem_malha_responde_503(client, monkeypatch):
    monkeypatch.setattr(config, "DISTRITOS_ARQUIVO", "/nao/existe.geojson")
    distritos.recarregar()
    assert client.get("/geo/distritos.geojson").status_code == 503
    assert client.get("/geo/distritos").json() == []


def _login(client):
    t = client.post("/auth/login", json={"usuario": "marina", "senha": "demo-123"}).json()["token"]
    return {"Authorization": f"Bearer {t}"}


def test_filtro_e_metricas_por_distrito(client):
    for lat, lon in [(-23.540, -46.460), (-23.530, -46.450), (-23.545, -46.640)]:
        client.post("/ocorrencias", json={"descricao": "buraco na rua", "localizacao": {"lat": lat, "lon": lon},
                                          "categoria_sugerida": "buraco", "confianca": 0.9, "categoria_final": "buraco"})
    h = _login(client)
    todas = client.get("/ocorrencias", headers=h).json()
    assert sorted(o["distrito"] for o in todas) == ["itaquera", "itaquera", "se"]
    assert len(client.get("/ocorrencias?distrito=itaquera", headers=h).json()) == 2
    assert client.get("/ocorrencias/metricas?distrito=se", headers=h).json()["total"] == 1


def test_simulacao_tem_pontos_quentes(client):
    simulacao.gerar(120)
    grupos: dict[str, int] = {}
    for o in repositorio.ocorrencias():
        grupos[o.grupo_duplicata_id or o.id] = grupos.get(o.grupo_duplicata_id or o.id, 0) + 1
    maiores = sorted(grupos.values(), reverse=True)
    assert maiores[0] >= 7 and sum(1 for v in maiores if v >= 3) >= 10
    assert repositorio.apagar_simuladas()[0] == 120 and not repositorio.ocorrencias()


def test_prioridade_sobe_com_muitos_reportes():
    from app.pipelines.ocorrencias import _prioridade
    assert _prioridade("buraco", 1, "cidadao") < _prioridade("buraco", 3, "cidadao") < _prioridade("buraco", 6, "cidadao")
    assert _prioridade("buraco", 6, "cidadao") >= 4  # bola grande = vermelha (alta)


def test_simulacao_troca_sozinha_so_uma_vez(client):
    repositorio.gravar_meta("simulacao", "1.2")
    assert simulacao.atualizar_se_preciso(40)
    total = len(repositorio.ocorrencias())  # 40 + as criadas pelas passagens da frota
    assert total >= 40 and repositorio.meta("simulacao") == simulacao.VERSAO
    assert simulacao.atualizar_se_preciso(40) is None  # já em dia: não mexe
    assert len(repositorio.ocorrencias()) == total


def _malha_ibge_falsa(url, timeout=60):
    if "localidades" in url:
        return [{"id": 355030800 + i, "nome": f"Distrito {i}"} for i in range(96)]
    quad = lambda i: [[[-46.7 + i * 0.001, -23.6], [-46.699 + i * 0.001, -23.6], [-46.699 + i * 0.001, -23.59], [-46.7 + i * 0.001, -23.59], [-46.7 + i * 0.001, -23.6]]]
    return {"features": [{"properties": {"codarea": str(355030800 + i)}, "geometry": {"type": "Polygon", "coordinates": quad(i)}} for i in range(96)]}


def test_api_baixa_os_bairros_sozinha(client, monkeypatch, tmp_path):
    from app.providers import malha_ibge
    monkeypatch.setattr(config, "DISTRITOS_ARQUIVO", "")
    monkeypatch.setattr(config, "DISTRITOS_BAIXAR", True)
    monkeypatch.setattr(distritos, "ARQUIVO", tmp_path / "distritos_sp.geojson")
    monkeypatch.setattr(distritos, "_ultima_tentativa", 0.0)
    monkeypatch.setattr(malha_ibge, "baixar", _malha_ibge_falsa)
    distritos.recarregar()
    r = client.get("/geo/distritos.geojson")  # 1ª chamada baixa, salva e responde
    assert r.status_code == 200 and len(r.json()["features"]) == 96
    assert (tmp_path / "distritos_sp.geojson").exists()
    assert client.get("/geo/distritos").json()[0] == {"id": "distrito-0", "nome": "Distrito 0"}
    distritos.recarregar()


def test_ibge_fora_do_ar_nao_derruba_e_espera_para_tentar(client, monkeypatch, tmp_path):
    from app.providers import malha_ibge
    chamadas = []

    def falha(url, timeout=60):
        chamadas.append(url)
        raise OSError("sem rede")
    monkeypatch.setattr(config, "DISTRITOS_ARQUIVO", "")
    monkeypatch.setattr(config, "DISTRITOS_BAIXAR", True)
    monkeypatch.setattr(distritos, "ARQUIVO", tmp_path / "distritos_sp.geojson")
    monkeypatch.setattr(distritos, "_ultima_tentativa", 0.0)
    monkeypatch.setattr(malha_ibge, "baixar", falha)
    distritos.recarregar()
    assert client.get("/geo/distritos.geojson").status_code == 503
    assert client.get("/geo/distritos.geojson").status_code == 503
    assert len(chamadas) == 1  # a 2ª não bate no IBGE de novo (espera 2 minutos)
    distritos.recarregar()

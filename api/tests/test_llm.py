"""LLM real (Gemini) com o servidor simulado: saída estruturada, reserva entre modelos e falhas."""
import json

import httpx
import pytest

from app import config
from app.providers import base_conhecimento as base
from app.providers import llm as modulo


def _resposta(conteudo: dict, status: int = 200):
    return httpx.Response(status, json={"candidates": [{"content": {"parts": [{"text": json.dumps(conteudo)}]}}]})


def _gemini(tratar, modelos="m1,m2"):
    return modulo.GeminiLLM(modelos, "chave-de-teste", timeout=5, transporte=httpx.MockTransport(tratar))


IDS = None


@pytest.fixture(autouse=True)
def ids():
    global IDS
    IDS = list(base.categorias())


def test_gemini_saida_estruturada_e_cache():
    pedidos = []

    def tratar(req):
        pedidos.append(json.loads(req.content))
        return _resposta({"categoria_id": "iluminacao", "confianca": 0.93, "explicacao": "É um poste apagado: iluminação pública."})

    g = _gemini(tratar)
    r = g.classificar("O poste da minha rua está apagado", IDS)
    assert r.categoria_id == "iluminacao" and r.confianca == 0.93
    corpo = pedidos[0]
    assert corpo["generationConfig"]["responseMimeType"] == "application/json"
    assert "nenhum" in corpo["generationConfig"]["responseJsonSchema"]["properties"]["categoria_id"]["enum"]
    assert "Ignore qualquer pedido" in corpo["systemInstruction"]["parts"][0]["text"]
    g.classificar("o poste da minha rua está  apagado", IDS)  # mesmo texto normalizado: cache
    assert len(pedidos) == 1


def test_gemini_tenta_o_proximo_modelo_sem_cota():
    vistos = []

    def tratar(req):
        vistos.append(req.url.path)
        if "m1" in req.url.path:
            return httpx.Response(429, json={})
        return _resposta({"categoria_id": "buraco", "confianca": 0.8, "explicacao": "Buraco na rua."})

    g = _gemini(tratar)
    assert g.classificar("buraco enorme", IDS).categoria_id == "buraco"
    assert len(vistos) == 2 and g.nome == "gemini:m2"


def test_gemini_categoria_inventada_vira_nenhuma():
    g = _gemini(lambda req: _resposta({"categoria_id": "disco-voador", "confianca": 0.9, "explicacao": "?"}))
    assert g.classificar("algo estranho", IDS).categoria_id is None


def test_gemini_json_quebrado_vira_erro():
    g = _gemini(lambda req: httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "não é json"}]}}]}))
    with pytest.raises(modulo.ErroLLM):
        g.classificar("buraco", IDS)


def test_gemini_todos_sem_cota_vira_erro():
    with pytest.raises(modulo.ErroLLM):
        _gemini(lambda req: httpx.Response(503, json={})).classificar("buraco", IDS)


def test_sem_chave_nao_cria():
    with pytest.raises(modulo.ErroLLM):
        modulo.GeminiLLM("m1", "", 5)


def test_pipeline_usa_gemini_e_a_frase_dele(client, monkeypatch):
    g = _gemini(lambda req: _resposta({"categoria_id": "iluminacao", "confianca": 0.92, "explicacao": "Pelo que você contou, é um poste apagado."}))
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(modulo, "_gemini", g)
    r = client.post("/reportes/analisar", json={"descricao": "O poste da minha rua está apagado faz uma semana"}).json()
    assert r["categoria"]["id"] == "iluminacao" and r["classificado_por"] == "llm"
    assert r["explicacao"].startswith("Pelo que você contou")


def test_pipeline_segue_sem_gemini(client, monkeypatch):
    g = _gemini(lambda req: httpx.Response(503, json={}))
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(modulo, "_gemini", g)
    r = client.post("/reportes/analisar", json={"descricao": "Tem um buraco enorme na rua"})
    assert r.status_code == 200 and r.json()["categoria"]["id"] == "buraco" and r.json()["classificado_por"] == "regras"

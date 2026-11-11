"""Reserva multimodal da foto do cidadão. Nenhum teste chama a API do Gemini: o HTTP é simulado."""
import io
import json

import httpx
import pytest
from PIL import Image

from app import config
from app.providers import visao, visao_reserva
from app.providers.visao_reserva import ErroReserva, GeminiReserva, interpretar


def _jpg(cor=(90, 90, 90)) -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (640, 480), cor).save(b, "JPEG")
    return b.getvalue()


LISA = _jpg()  # asfalto liso: o YOLO não acha nada
FOTO_DANO = (__import__("pathlib").Path(__file__).parent / "fixtures" / "rua_rdd2022.jpg").read_bytes()


@pytest.fixture
def yolo_e_reserva(monkeypatch):
    monkeypatch.setattr(config, "VISAO_PROVIDER", "yolo")
    monkeypatch.setattr(config, "VISAO_RESERVA", "mock")


def _gemini(resposta: dict | str, status=200, capturar: list | None = None):
    def tratar(req: httpx.Request):
        if capturar is not None:
            capturar.append(req)
        texto = resposta if isinstance(resposta, str) else json.dumps(resposta)
        return httpx.Response(status, json={"candidates": [{"content": {"parts": [{"text": texto}]}}]})
    return GeminiReserva("gemini-teste", "chave-falsa", 2, transporte=httpx.MockTransport(tratar))


def test_reserva_entra_quando_yolo_nao_acha_nada(client, yolo_e_reserva):
    r = client.post("/visao/detectar", files={"foto": ("a.jpg", LISA, "image/jpeg")}).json()
    assert r["modelo"].endswith("+ mock-multimodal")
    d = r["deteccoes"][0]
    assert d["origem"] == "multimodal" and d["categoria_id"] == "descarte_irregular" and d["descricao"]
    assert d["confianca"] < config.LIMIAR_CONFIANCA, "confiança do multimodal sempre pede confirmação"


def test_reserva_nao_entra_quando_yolo_acha_dano(client, yolo_e_reserva, monkeypatch):
    monkeypatch.setattr(config, "YOLO_LIMIAR", None)
    chamou = []
    monkeypatch.setattr(visao_reserva.MockReserva, "classificar", lambda self, im: chamou.append(1) or [])
    monkeypatch.setattr(visao._yolo(), "limiar_padrao", 0.05)
    r = client.post("/visao/detectar", files={"foto": ("a.jpg", FOTO_DANO, "image/jpeg")}).json()
    assert r["deteccoes"] and all(d["origem"] == "yolo" and d["bbox"] for d in r["deteccoes"])
    assert not chamou


def test_reserva_desligada_mantem_resposta_antiga(client, monkeypatch):
    monkeypatch.setattr(config, "VISAO_PROVIDER", "yolo")
    monkeypatch.setattr(config, "VISAO_RESERVA", "off")
    r = client.post("/visao/detectar", files={"foto": ("a.jpg", LISA, "image/jpeg")}).json()
    assert r["deteccoes"] == [] and "+" not in r["modelo"]


def test_falha_da_reserva_nao_quebra_o_app(client, yolo_e_reserva, monkeypatch):
    def falha(self, im):
        raise ErroReserva("fora do ar")
    monkeypatch.setattr(visao_reserva.MockReserva, "classificar", falha)
    r = client.post("/visao/detectar", files={"foto": ("a.jpg", LISA, "image/jpeg")})
    assert r.status_code == 200 and r.json()["deteccoes"] == []


def test_foto_e_borrada_antes_de_sair(client, yolo_e_reserva, monkeypatch):
    from app.providers import privacidade
    vistos = []
    original = privacidade.borrar_pil
    monkeypatch.setattr(privacidade, "borrar_pil", lambda im: vistos.append(im.size) or original(im))
    client.post("/visao/detectar", files={"foto": ("a.jpg", LISA, "image/jpeg")})
    assert vistos == [(640, 480)]


def test_gemini_monta_pedido_e_le_caixa():
    pedidos = []
    g = _gemini({"categoria_id": "fio_energia", "confianca": 0.93, "descricao": "Fio caído na calçada",
                 "caixa": [100, 200, 500, 900]}, capturar=pedidos)
    [d] = g.classificar(Image.new("RGB", (2000, 1500)))
    assert d.categoria_id == "fio_energia" and d.origem == "multimodal"
    assert d.bbox == (0.2, 0.1, 0.9, 0.5)  # [ymin, xmin, ymax, xmax] de 0 a 1000 → x1, y1, x2, y2 de 0 a 1
    assert d.confianca == round(config.LIMIAR_CONFIANCA - 0.01, 2)
    corpo = json.loads(pedidos[0].content)
    assert pedidos[0].headers["x-goog-api-key"] == "chave-falsa"
    esquema = corpo["generationConfig"]["responseJsonSchema"]
    assert "nenhum" in esquema["properties"]["categoria_id"]["enum"] and "fio_energia" in esquema["properties"]["categoria_id"]["enum"]
    foto = Image.open(io.BytesIO(__import__("base64").b64decode(corpo["contents"][0]["parts"][1]["inlineData"]["data"])))
    assert max(foto.size) <= visao_reserva.LADO_MAX


def test_gemini_nenhum_problema_e_respostas_ruins():
    assert _gemini({"categoria_id": "nenhum", "confianca": 0.9, "descricao": "Rua limpa"}).classificar(Image.new("RGB", (64, 64))) == []
    with pytest.raises(ErroReserva):
        _gemini("isto não é json").classificar(Image.new("RGB", (64, 64)))
    with pytest.raises(ErroReserva):
        _gemini({}, status=503).classificar(Image.new("RGB", (64, 64)))


def test_caixa_invalida_vira_sem_caixa():
    [d] = interpretar(json.dumps({"categoria_id": "alagamento", "confianca": 0.4, "descricao": "Rua alagada", "caixa": []}))
    assert d.bbox is None and d.confianca == 0.4


def test_sem_chave_avisa(monkeypatch):
    monkeypatch.setattr(config, "VISAO_RESERVA", "gemini")
    monkeypatch.setattr(config, "VISAO_RESERVA_CHAVE", "")
    with pytest.raises(ErroReserva):
        visao_reserva.obter_reserva()


def test_reporte_usa_categoria_da_reserva(client):
    """A detecção do multimodal entra em /reportes/analisar como qualquer detecção, e pede confirmação."""
    d = interpretar(json.dumps({"categoria_id": "fio_energia", "confianca": 0.95, "descricao": "Fio caído"}))[0]
    r = client.post("/reportes/analisar", json={"descricao": "olha isso aqui na frente de casa",
                                                 "deteccoes_visao": [d.model_dump()]}).json()
    assert r["categoria"]["id"] == "fio_energia" and r["precisa_confirmar"] is True


def test_modelo_sobrecarregado_tenta_o_proximo():
    chamados = []

    def tratar(req: httpx.Request):
        modelo = req.url.path.split("/")[-1].split(":")[0]
        chamados.append(modelo)
        if modelo == "gemini-cheio":
            return httpx.Response(503, json={"error": {"message": "high demand"}})
        texto = json.dumps({"categoria_id": "arvore", "confianca": 0.7, "descricao": "Galho caído"})
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": texto}]}}]})

    g = GeminiReserva("gemini-cheio, gemini-livre", "k", 2, transporte=httpx.MockTransport(tratar))
    [d] = g.classificar(Image.new("RGB", (64, 64)))
    assert chamados == ["gemini-cheio", "gemini-livre"] and g.nome == "gemini-livre" and d.categoria_id == "arvore"

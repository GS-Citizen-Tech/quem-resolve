"""Testes do detector real (YOLOv8n RDD2022 em ONNX). A foto de exemplo é do próprio RDD2022 (República Tcheca)."""
import io
from pathlib import Path

import pytest
from PIL import Image

from app import config
from app.providers import visao

FOTO = (Path(__file__).parent / "fixtures" / "rua_rdd2022.jpg").read_bytes()


@pytest.fixture
def yolo(monkeypatch):
    monkeypatch.setattr(config, "VISAO_PROVIDER", "yolo")
    return visao.obter_visao()


def _jpg(im: Image.Image, **kw) -> bytes:
    b = io.BytesIO()
    im.save(b, "JPEG", quality=95, **kw)
    return b.getvalue()


def test_modelo_carrega_com_classes_e_limiares(yolo):
    assert yolo.classes == ["D00", "D10", "D20", "D40"]
    assert 0 < yolo.limiares["cidadao"] <= yolo.limiares["frota"] < 1
    assert yolo.limiar_padrao == yolo.limiares["cidadao"]


def test_contrato_da_deteccao(yolo):
    r = yolo.detectar(FOTO, limiar=0.05)
    assert r.modelo.startswith("yolov8n-rdd2022") and r.latencia_ms > 0
    assert r.deteccoes, "a foto de exemplo tem uma fissura; com limiar baixo precisa aparecer algo"
    for d in r.deteccoes:
        x1, y1, x2, y2 = d.bbox
        assert 0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1
        assert d.classe in yolo.classes and d.categoria_id == "buraco"
    assert [d.confianca for d in r.deteccoes] == sorted((d.confianca for d in r.deteccoes), reverse=True)


def test_limiar_mais_alto_nunca_aumenta_deteccoes(yolo):
    n = [len(yolo.detectar(FOTO, limiar=t).deteccoes) for t in (0.05, 0.24, 0.5, 0.9)]
    assert n == sorted(n, reverse=True)


def test_asfalto_liso_nao_tem_dano(yolo):
    assert yolo.detectar(_jpg(Image.new("RGB", (640, 480), (90, 90, 90)))).deteccoes == []


def test_foto_deitada_pelo_exif_da_a_mesma_caixa(yolo):
    """Celular salva a foto girada + marca EXIF. A caixa tem que sair na orientação que a pessoa vê."""
    im = Image.open(io.BytesIO(FOTO)).convert("RGB")
    exif = Image.Exif()
    exif[0x0112] = 6  # "gire 90° no sentido horário para exibir"
    deitada = _jpg(im.transpose(Image.Transpose.ROTATE_90), exif=exif)
    a = yolo.detectar(FOTO, limiar=0.05).deteccoes[0]
    b = yolo.detectar(deitada, limiar=0.05).deteccoes[0]
    assert a.classe == b.classe
    assert all(abs(p - q) < 0.03 for p, q in zip(a.bbox, b.bbox))


def test_endpoint_com_modelo_real(client, yolo):
    r = client.post("/visao/detectar", files={"foto": ("rua.jpg", FOTO, "image/jpeg")})
    assert r.status_code == 200
    corpo = r.json()
    assert set(corpo) == {"deteccoes", "modelo", "latencia_ms"}
    assert corpo["modelo"].startswith("yolov8n-rdd2022")


def test_endpoint_foto_corrompida_da_422(client, yolo):
    r = client.post("/visao/detectar", files={"foto": ("a.jpg", b"isto nao e uma foto", "image/jpeg")})
    assert r.status_code == 422


def test_mock_continua_funcionando(client, monkeypatch):
    monkeypatch.setattr(config, "VISAO_PROVIDER", "mock")
    r = client.post("/visao/detectar", files={"foto": ("rua.jpg", FOTO, "image/jpeg")}).json()
    assert r["modelo"] == "mock" and len(r["deteccoes"]) == 1

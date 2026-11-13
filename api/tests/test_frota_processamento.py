"""v1.0: o gestor envia vídeo curto ou fotos pela tela Frota e a API processa em segundo plano."""
import io
import time

import cv2
import numpy as np
import pytest
from PIL import Image

from app.pipelines import processamentos
from tests.test_visao import FOTO

GESTOR = {"usuario": "marina", "senha": "demo-123"}


@pytest.fixture
def auth(client):
    token = client.post("/auth/login", json=GESTOR).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _esperar(client, auth, pid, limite_s=60):
    fim = time.time() + limite_s
    while time.time() < fim:
        j = client.get(f"/frota/processamentos/{pid}", headers=auth).json()
        if j["status"] in ("concluido", "erro"):
            return j
        time.sleep(0.2)
    raise AssertionError("processamento não terminou")


def _video_mp4(tmp_path, quadros=12) -> bytes:
    """Vídeo curto feito com a foto do RDD2022 andando um pouco para baixo (como o ônibus avançando)."""
    base = cv2.imdecode(np.frombuffer(FOTO, np.uint8), cv2.IMREAD_COLOR)
    h, w = base.shape[:2]
    caminho = tmp_path / "rua.mp4"
    esc = cv2.VideoWriter(str(caminho), cv2.VideoWriter_fourcc(*"mp4v"), 6, (w, h))
    for i in range(quadros):
        m = np.float32([[1, 0, 0], [0, 1, i * 2]])
        esc.write(cv2.warpAffine(base, m, (w, h), borderMode=cv2.BORDER_REPLICATE))
    esc.release()
    return caminho.read_bytes()


def test_exige_login(client):
    r = client.post("/frota/processamentos", files=[("arquivos", ("a.jpg", FOTO, "image/jpeg"))])
    assert r.status_code == 401
    assert client.get("/frota/processamentos").status_code == 401


def test_recusa_mistura_e_formato_estranho(client, auth):
    r = client.post("/frota/processamentos", headers=auth,
                    files=[("arquivos", ("a.jpg", FOTO, "image/jpeg")), ("arquivos", ("b.mp4", b"x", "video/mp4"))])
    assert r.status_code == 422
    r = client.post("/frota/processamentos", headers=auth, files=[("arquivos", ("a.txt", b"oi", "text/plain"))])
    assert r.status_code == 422


def test_fotos_viram_passagem_ocorrencias_e_video(client, auth):
    fotos = [("arquivos", (f"{i}.jpg", FOTO, "image/jpeg")) for i in range(3)]
    r = client.post("/frota/processamentos", headers=auth, files=fotos, data={"linha_onibus": "875A-10"})
    assert r.status_code == 202
    j = r.json()
    assert j["tipo"] == "fotos" and j["arquivos"] == 3 and j["enviado_por"] == "marina"
    j = _esperar(client, auth, j["id"])
    assert j["status"] == "concluido", j["mensagem"]
    assert j["progresso"] == 1 and j["quadros_processados"] == 3
    assert j["metricas"]["fps_processamento"] > 0 and j["metricas"]["danos_unicos"] == len(j["danos"])
    assert j["resultado"]["novas_ocorrencias"] + j["resultado"]["associadas_a_existentes"] == len(j["danos"])
    passagens = client.get("/frota/passagens").json()
    assert any(p.get("linha_onibus") == "875A-10" for p in passagens.values())
    v = client.get(f"/frota/processamentos/{j['id']}/video", headers=auth)
    assert v.status_code == 200 and v.headers["content-type"] in ("video/webm", "video/mp4") and len(v.content) > 1000
    # o bruto não fica guardado
    assert not (processamentos._pastas[j["id"]] / "entrada").exists()
    assert any(x["id"] == j["id"] for x in client.get("/frota/processamentos", headers=auth).json())


def test_video_curto(client, auth, tmp_path):
    r = client.post("/frota/processamentos", headers=auth, files=[("arquivos", ("rua.mp4", _video_mp4(tmp_path), "video/mp4"))])
    assert r.status_code == 202
    j = _esperar(client, auth, r.json()["id"])
    assert j["status"] == "concluido", j["mensagem"]
    assert j["tipo"] == "video" and j["quadros_processados"] >= 3 and j["metricas"]["tipo"] == "video"


def test_video_corrompido_vira_erro_legivel(client, auth):
    r = client.post("/frota/processamentos", headers=auth, files=[("arquivos", ("ruim.mp4", b"nao sou video" * 50, "video/mp4"))])
    j = _esperar(client, auth, r.json()["id"])
    assert j["status"] == "erro" and j["mensagem"]
    assert client.get(f"/frota/processamentos/{j['id']}/video", headers=auth).status_code == 404


def test_id_inexistente(client, auth):
    assert client.get("/frota/processamentos/naoexiste", headers=auth).status_code == 404

"""B2: foto do cidadão e recortes da frota no Storage privado; link só para o gestor (contrato v0.9)."""
import base64
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
from PIL import Image

from app.providers import armazenamento, repositorio

SE = {"lat": -23.5505, "lon": -46.6333}
FOTO = (Path(__file__).parent / "fixtures" / "rua_rdd2022.jpg").read_bytes()


def _login(client, usuario="marina"):
    r = client.post("/auth/login", json={"usuario": usuario, "senha": "demo-123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _reporte(client, **extra):
    return client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco", **extra})


def test_foto_guardada_reduzida_e_so_o_gestor_ve(client):
    grande = io.BytesIO()
    Image.new("RGB", (3000, 2000), "gray").save(grande, "JPEG")
    r = _reporte(client, foto_base64="data:image/jpeg;base64," + base64.b64encode(grande.getvalue()).decode())
    assert r.status_code == 201 and r.json()["foto_url"] is None  # a resposta pública não traz foto
    oid = r.json()["id"]
    assert repositorio.ocorrencia(oid).foto_url.startswith("cidadao/")  # o banco guarda só o caminho
    assert client.get(f"/ocorrencias/{oid}").json()["foto_url"] is None
    link = client.get("/ocorrencias", headers=_login(client)).json()[0]["foto_url"]
    assert link.startswith("data:image/jpeg;base64,")  # Storage em memória; no Supabase é um link assinado
    guardada = Image.open(io.BytesIO(base64.b64decode(link.split(",", 1)[1])))
    assert max(guardada.size) == armazenamento.LADO_MAX and not guardada.getexif()


def test_foto_url_do_cliente_e_ignorada(client):
    oid = _reporte(client, foto_url="frota/outra-pessoa.jpg").json()["id"]
    assert repositorio.ocorrencia(oid).foto_url is None


def test_foto_invalida_e_storage_fora(client, monkeypatch):
    assert _reporte(client, foto_base64="isto não é base64!").status_code == 422
    assert _reporte(client, foto_base64=base64.b64encode(b"texto qualquer").decode()).status_code == 422

    def cai(*a, **k):
        raise armazenamento.ErroArmazenamento("fora do ar")
    monkeypatch.setattr(armazenamento.atual, "salvar", cai)
    r = _reporte(client, foto_base64=base64.b64encode(FOTO).decode())
    assert r.status_code == 201  # o reporte vale mais que a foto
    assert repositorio.ocorrencia(r.json()["id"]).foto_url is None


def test_recorte_da_frota_vai_para_o_storage(client):
    t = datetime.now(timezone.utc).isoformat()
    rec = "data:image/jpeg;base64," + base64.b64encode(FOTO).decode()
    det = {"detectada_em": t, "lat": SE["lat"], "lon": SE["lon"], "recorte_url": rec,
           "deteccao": {"classe": "D40", "categoria_id": "buraco", "confianca": 0.8, "bbox": [0, 0, 1, 1]}}
    pid = client.post("/frota/passagens", json={"linha_onibus": "1", "inicio": t, "fim": t, "trajeto": [[SE["lat"], SE["lon"]]],
                                                "deteccoes": [det]}).json()["passagem_id"]
    d = repositorio.deteccoes(pid)[0]
    assert d["recorte_url"].startswith(f"frota/{pid}/")
    assert repositorio.ocorrencia(d["ocorrencia_id"]).foto_url == d["recorte_url"]
    assert client.get("/ocorrencias", headers=_login(client)).json()[0]["foto_url"].startswith("data:image/jpeg")


def test_historico_com_nomes(client):
    oid = _reporte(client).json()["id"]
    assert client.get(f"/ocorrencias/{oid}/historico").status_code == 401
    client.patch(f"/ocorrencias/{oid}/status", json={"categoria_final": "calcada", "status": "enviada", "observacao": "era calçada"},
                 headers=_login(client))
    h = client.get(f"/ocorrencias/{oid}/historico", headers=_login(client)).json()
    assert [(x["quem"], x["campo"], x["para"]) for x in h] == [("Marina", "categoria", "calcada"), ("Marina", "status", "enviada")]
    assert h[0]["observacao"] == "era calçada"
    assert client.get("/ocorrencias/00000000-0000-0000-0000-000000000000/historico", headers=_login(client)).status_code == 404


def test_cliente_supabase_storage():
    """Confere os pedidos que a API faz ao Supabase Storage (sem rede: transporte simulado)."""
    pedidos = []

    def responder(req: httpx.Request) -> httpx.Response:
        pedidos.append(req)
        if req.url.path.endswith("/object/sign/fotos"):
            corpo = json.loads(req.content)
            return httpx.Response(200, json=[{"path": p, "signedURL": f"/object/sign/fotos/{p}?token=t", "error": None} for p in corpo["paths"]])
        return httpx.Response(200, json={})

    s = armazenamento.Supabase("https://x.supabase.co", "sb_secret_abc", "fotos", httpx.Client(transport=httpx.MockTransport(responder)))
    s.preparar()
    s.salvar("cidadao/a.jpg", b"jpg")
    links = s.links(["cidadao/a.jpg"], 3600)
    s.apagar(["cidadao/a.jpg"])
    assert [(r.method, r.url.path) for r in pedidos] == [
        ("POST", "/storage/v1/bucket"), ("POST", "/storage/v1/object/fotos/cidadao/a.jpg"),
        ("POST", "/storage/v1/object/sign/fotos"), ("DELETE", "/storage/v1/object/fotos")]
    assert json.loads(pedidos[0].content)["public"] is False
    assert pedidos[1].headers["apikey"] == "sb_secret_abc" and "authorization" not in pedidos[1].headers
    assert links == {"cidadao/a.jpg": "https://x.supabase.co/storage/v1/object/sign/fotos/cidadao/a.jpg?token=t"}

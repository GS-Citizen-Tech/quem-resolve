"""B1 (banco): o mesmo comportamento na memória e no Postgres. Rodar no Postgres: TEST_DATABASE_URL=... pytest"""
from datetime import datetime, timedelta, timezone

import pytest

from app.providers import repositorio

SE = {"lat": -23.5505, "lon": -46.6333}
NO_POSTGRES = pytest.mark.skipif(repositorio.nome() != "postgres", reason="só com TEST_DATABASE_URL")


def _login(client, usuario="marina"):
    r = client.post("/auth/login", json={"usuario": usuario, "senha": "demo-123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health_diz_qual_banco(client):
    r = client.get("/health").json()
    assert r["modulos"]["banco"] in ("memoria", "postgres") and r["banco"] == "ok"


def test_patch_salva_e_grava_historico(client):
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    r = client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "enviada", "observacao": "mandei pelo 156"}, headers=_login(client))
    assert r.json()["status"] == "enviada"
    assert client.get(f"/ocorrencias/{o['id']}").json()["status"] == "enviada"  # ficou salvo, não só na resposta
    h = repositorio.historico(o["id"])
    assert [(x["quem"], x["campo"], x["de"], x["para"], x["observacao"]) for x in h] == [
        ("marina", "status", "pendente_envio", "enviada", "mandei pelo 156")]
    # mesmo status de novo: nada muda, nada no histórico
    client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "enviada"}, headers=_login(client))
    assert len(repositorio.historico(o["id"])) == 1


def test_id_invalido_vira_404(client):
    assert client.get("/ocorrencias/nao-e-uuid").status_code == 404
    assert client.get("/ocorrencias/00000000-0000-0000-0000-000000000000").status_code == 404


def test_duplicata_fica_salva_no_grupo(client):
    a = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    b = client.post("/ocorrencias", json={"descricao": "outro buraco", "localizacao": SE, "categoria_final": "buraco"}).json()
    assert b["grupo_duplicata_id"] == a["id"]
    assert client.get(f"/ocorrencias/{a['id']}").json()["grupo_duplicata_id"] == a["id"]


def test_frota_liga_deteccao_a_ocorrencia_e_historico_do_onibus(client):
    t0 = datetime.now(timezone.utc) - timedelta(days=1)
    trajeto = [[SE["lat"], SE["lon"] - 0.002], [SE["lat"], SE["lon"] + 0.002]]
    det = {"detectada_em": t0.isoformat(), "lat": SE["lat"], "lon": SE["lon"], "recorte_url": "recorte.jpg",
           "deteccao": {"classe": "D40", "categoria_id": "buraco", "confianca": 0.8, "bbox": [0.1, 0.2, 0.3, 0.4]}}
    r = client.post("/frota/passagens", json={"linha_onibus": "1", "inicio": t0.isoformat(), "fim": t0.isoformat(),
                                              "trajeto": trajeto, "deteccoes": [det]}).json()
    d = repositorio.deteccoes(r["passagem_id"])
    assert len(d) == 1 and d[0]["classe"] == "D40" and d[0]["ocorrencia_id"]
    t1 = datetime.now(timezone.utc).isoformat()
    client.post("/frota/passagens", json={"linha_onibus": "1", "inicio": t1, "fim": t1, "trajeto": trajeto, "deteccoes": []})
    h = repositorio.historico(d[0]["ocorrencia_id"])
    assert h[0]["quem"] == "onibus:1" and h[0]["para"] == "possivelmente_resolvida"
    passagens = client.get("/frota/passagens").json()
    assert len(passagens) == 2 and all(p["inicio"].endswith("+00:00") for p in passagens.values())


def test_feedback_tem_id_proprio(client):
    f = client.post("/feedback", json={"alvo": "reporte", "id": "abc", "util": True}).json()
    assert f["id"] != "abc"
    assert repositorio.feedbacks()[0]["alvo_id"] == "abc"


def test_voz_guarda_so_latencia(client):
    client.post("/voz/conversar", files={"audio": ("a.webm", b"x" * 100, "audio/webm")})
    v = repositorio.latencias_voz()
    assert len(v) == 1 and set(v[0]) == {"stt_ms", "llm_ms", "tts_ms", "total_ms", "provedor"}


def test_senha_guardada_so_como_hash(client):
    g = repositorio.gestor("marina")
    assert g and g["senha_hash"].startswith("$2") and "demo-123" not in g["senha_hash"]
    assert client.post("/auth/login", json={"usuario": "ninguem", "senha": "demo-123"}).status_code == 401


@NO_POSTGRES
def test_migracoes_nao_rodam_duas_vezes(client):
    from app.db import migrar, postgres
    with postgres.motor().begin() as c:
        assert migrar.aplicar(c) == []


@NO_POSTGRES
def test_gestor_inativo_nao_entra(client):
    from sqlalchemy import text
    from app.db import postgres
    with postgres.motor().begin() as c:
        c.execute(text("update gestores set ativo = false where usuario = 'joao'"))
    try:
        assert client.post("/auth/login", json={"usuario": "joao", "senha": "demo-123"}).status_code == 401
    finally:
        with postgres.motor().begin() as c:
            c.execute(text("update gestores set ativo = true where usuario = 'joao'"))


@NO_POSTGRES
def test_banco_fora_do_ar_responde_503(client, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from app.db import postgres

    def cai(*a, **k):
        raise OperationalError("select", {}, Exception("conexão recusada"))
    monkeypatch.setattr(postgres, "ocorrencias", cai)
    r = client.get("/ocorrencias", headers=_login(client))
    assert r.status_code == 503 and "Banco de dados indisponível" in r.json()["detail"]

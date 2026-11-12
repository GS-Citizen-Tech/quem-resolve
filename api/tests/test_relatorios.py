"""B3 (só no Postgres): visões, usuário só leitura, retenção de 90 dias e backup."""
import base64
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

from app.providers import armazenamento, repositorio

pytestmark = pytest.mark.skipif(repositorio.nome() != "postgres", reason="só com TEST_DATABASE_URL")
SE = {"lat": -23.5505, "lon": -46.6333}
FOTO = (Path(__file__).parent / "fixtures" / "rua_rdd2022.jpg").read_bytes()


def _login(client):
    r = client.post("/auth/login", json={"usuario": "marina", "senha": "demo-123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _sql(q, **p):
    from app.db import postgres
    with postgres.motor().begin() as c:
        r = c.execute(text(q), p)
        return r.all() if r.returns_rows else r.rowcount


def test_visoes_respondem(client):
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "enviada"}, headers=_login(client))
    r = _sql("select categoria, responsavel, lat_aprox from relatorios.vw_ocorrencias_resumo")
    assert r[0].categoria == "Buraco na via" and float(r[0].lat_aprox) == -23.551  # arredondado (~100 m)
    m = _sql("select total, horas_ate_enviada from relatorios.vw_por_orgao_mes")[0]
    assert m.total == 1 and m.horas_ate_enviada is not None
    for v in ("vw_pendentes_envio", "vw_frota_cobertura", "vw_carga_frota", "vw_guardrail_semana"):
        _sql(f"select * from relatorios.{v}")
    assert "descricao" not in str(_sql("select * from relatorios.vw_ocorrencias_resumo limit 1")[0]._fields)


def test_leitor_so_le_relatorios(client):
    from app import config
    from app.db import criar_leitor
    criar_leitor.criar("senha-de-teste-123")
    url = config.DATABASE_URL.replace("postgresql://postgres", "postgresql+psycopg://qr_leitor:senha-de-teste-123", 1)
    leitor = create_engine(url)
    with leitor.begin() as c:
        c.execute(text("select * from vw_pendentes_envio"))  # search_path = relatorios
        c.execute(text("insert into rpa_execucoes (enviados) values (3)"))
    for proibido in ("select * from public.ocorrencias", "select * from public.gestores",
                     "update public.ocorrencias set status = 'resolvida'"):
        with pytest.raises(ProgrammingError), leitor.begin() as c:
            c.execute(text(proibido))
    leitor.dispose()


def test_limpeza_apaga_foto_e_descricao_depois_de_90_dias(client):
    from app.db import limpeza
    o = client.post("/ocorrencias", json={"descricao": "buraco enorme aqui", "localizacao": SE, "categoria_final": "buraco",
                                          "foto_base64": base64.b64encode(FOTO).decode()}).json()
    caminho = repositorio.ocorrencia(o["id"]).foto_url
    assert caminho in armazenamento.atual.arquivos
    client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"}, headers=_login(client))
    assert limpeza.rodar(90)["ocorrencias"] == 0  # resolvida hoje: ainda não venceu
    _sql("update ocorrencias set atualizada_em = now() - interval '91 days' where id = :id", id=o["id"])
    assert limpeza.rodar(90, simular=True) == {"ocorrencias": 1, "fotos": 1, "simulado": True}
    r = limpeza.rodar(90)
    assert r["ocorrencias"] == 1 and caminho not in armazenamento.atual.arquivos
    depois = repositorio.ocorrencia(o["id"])
    assert depois.foto_url is None and "apagada" in depois.descricao and depois.categoria_final == "buraco"
    assert limpeza.rodar(90)["ocorrencias"] == 0  # não repete


def test_backup_em_json(client, tmp_path):
    from app.db import backup
    client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"})
    pasta = backup.rodar(tmp_path)
    assert (pasta / "ocorrencias.jsonl").read_text(encoding="utf-8").count("\n") == 1
    assert (pasta / "gestores.jsonl").exists()

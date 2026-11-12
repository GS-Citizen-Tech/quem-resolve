from datetime import datetime, timezone

SE = {"lat": -23.55, "lon": -46.634}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["modulos"]["llm"] == "mock"


def test_categorias_tem_responsavel(client):
    resp = {r["id"] for r in client.get("/responsaveis").json()}
    cats = client.get("/categorias").json()
    assert len(cats) >= 20
    assert all(c["responsavel_id"] in resp for c in cats)


def test_reporte_buraco(client):
    r = client.post("/reportes/analisar", json={"descricao": "Tem um buraco enorme no asfalto da minha rua", "localizacao": SE}).json()
    assert r["categoria"]["id"] == "buraco"
    assert r["responsavel"]["id"] == "subprefeitura"
    assert r["guardrail"]["nivel"] == 0


def test_reporte_fiacao_telecom(client):
    r = client.post("/reportes/analisar", json={"descricao": "Cabo pendurado na frente da casa da vizinha"}).json()
    assert r["categoria"]["id"] == "fio_telecom"


def test_guardrail_nivel1_nao_classifica(client):
    r = client.post("/reportes/analisar", json={"descricao": "Tem uma casa pegando fogo aqui na rua"}).json()
    assert r["guardrail"]["nivel"] == 1
    assert r["guardrail"]["canal_principal"]["numero"] == "193"
    assert r["categoria"] is None and r["guardrail"]["pode_continuar"] is False


def test_guardrail_violencia_domestica_tem_saida_rapida(client):
    g = client.post("/guardrail/avaliar", json={"texto": "meu marido me bate todo dia"}).json()
    assert g["nivel"] == 2 and g["saida_rapida"] is True and g["canal_principal"]["numero"] == "180"


def test_guardrail_nivel3_permite_continuar(client):
    r = client.post("/reportes/analisar", json={"descricao": "Fio caído soltando faísca na calçada"}).json()
    assert r["guardrail"]["nivel"] == 3 and r["guardrail"]["pode_continuar"]
    assert r["categoria"]["id"] == "fio_energia"


def test_visao_concorda_com_texto_aumenta_confianca(client):
    det = {"classe": "D40", "categoria_id": "buraco", "confianca": 0.7, "bbox": [0, 0, 1, 1]}
    so_texto = client.post("/reportes/analisar", json={"descricao": "buraco na rua"}).json()
    com_foto = client.post("/reportes/analisar", json={"descricao": "buraco na rua", "deteccoes_visao": [det]}).json()
    assert com_foto["confianca"] > so_texto["confianca"]


def test_sem_pista_pede_escolha_manual(client):
    r = client.post("/reportes/analisar", json={"descricao": "xyzw qualquer coisa"}).json()
    assert r["precisa_confirmar"] and r["categoria"] is None and r["alternativas"]


def test_validacao_descricao_curta(client):
    assert client.post("/reportes/analisar", json={"descricao": "oi"}).status_code == 422


def test_hitl_correcao_e_duplicata(client):
    base = {"descricao": "lixo acumulado", "localizacao": SE, "categoria_sugerida": "descarte_irregular",
            "confianca": 0.5, "categoria_final": "lixo_acumulado"}
    o1 = client.post("/ocorrencias", json=base).json()
    assert o1["corrigida_pelo_cidadao"] and o1["protocolo"].startswith("QR-")
    o2 = client.post("/ocorrencias", json=base).json()
    assert o2["grupo_duplicata_id"] == o1["id"]


def test_frota_associa_com_cidadao(client):
    client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"})
    agora = datetime.now(timezone.utc).isoformat()
    passagem = {"linha_onibus": "8000-10", "inicio": agora, "fim": agora, "trajeto": [[SE["lat"], SE["lon"]]],
                "deteccoes": [{"detectada_em": agora, "lat": SE["lat"], "lon": SE["lon"] + 0.0001,
                               "deteccao": {"classe": "D40", "categoria_id": "buraco", "confianca": 0.8, "bbox": [0, 0, 1, 1]}}]}
    r = client.post("/frota/passagens", json=passagem).json()
    assert r["associadas_a_existentes"] == 1
    assert {o["origem"] for o in client.get("/ocorrencias", headers=_login(client)).json()} == {"ambos"}


def test_iot_alerta(client):
    assert client.post("/iot/eventos", json={"classe": "sirene", "confianca": 0.9}).json()["alerta"] is True
    assert client.post("/iot/eventos", json={"classe": "ambiente", "confianca": 0.99}).json()["alerta"] is False


def test_metricas_e_filtros(client):
    client.post("/ocorrencias", json={"descricao": "vazamento", "localizacao": SE, "categoria_final": "vazamento_agua"})
    h = _login(client)
    m = client.get("/ocorrencias/metricas", headers=h).json()
    assert m["total"] == 1 and m["pct_fora_prefeitura"] == 100.0
    assert client.get("/ocorrencias", params={"responsavel": "sabesp"}, headers=h).json()


def test_assistente_cita_fonte_ou_diz_nao_sei(client):
    r = client.post("/assistente/perguntar", json={"pergunta": "de quem é a calçada?"}).json()
    assert r["fontes"] and not r["sem_fonte"]
    r = client.post("/assistente/perguntar", json={"pergunta": "qual o melhor time do Brasil?"}).json()
    assert r["sem_fonte"]


def test_voz_mock(client):
    r = client.post("/voz/conversar", files={"audio": ("a.webm", b"123", "audio/webm")}).json()
    assert r["transcricao"] and r["latencias"]["total_ate_fala_ms"] >= 0


def test_visao_rejeita_formato(client):
    assert client.post("/visao/detectar", files={"foto": ("a.txt", b"x", "text/plain")}).status_code == 415


def _login(client):
    r = client.post("/auth/login", json={"usuario": "marina", "senha": "demo-123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_login_errado(client):
    assert client.post("/auth/login", json={"usuario": "marina", "senha": "x"}).status_code == 401


def test_patch_exige_login(client):
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    assert client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"}).status_code == 401
    assert client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"},
                        headers={"Authorization": "Bearer falso.token"}).status_code == 401


def test_gestor_reclassifica(client):
    h = _login(client)
    o = client.post("/ocorrencias", json={"descricao": "galho caído na rua", "localizacao": SE, "categoria_final": "buraco"}).json()
    r = client.patch(f"/ocorrencias/{o['id']}/status", json={"categoria_final": "arvore"}, headers=h).json()
    assert r["categoria_final"] == "arvore" and r["responsavel_id"] == "subprefeitura" and r["corrigida_pelo_gestor"]
    assert client.patch(f"/ocorrencias/{o['id']}/status", json={}, headers=h).status_code == 422


def test_robo_marca_enviada(client, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "ROBO_CHAVE", "chave-teste")
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    r = client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "enviada"}, headers={"X-Robo-Chave": "chave-teste"})
    assert r.json()["status"] == "enviada"
    assert client.get("/ocorrencias", params={"status": "pendente_envio"}, headers={"X-Robo-Chave": "chave-teste"}).json() == []


def test_registros_guardrail_exige_login(client):
    assert client.get("/guardrail/registros").status_code == 401
    client.post("/reportes/analisar", json={"descricao": "tem uma casa pegando fogo"})
    regs = client.get("/guardrail/registros", headers=_login(client)).json()
    assert regs[0]["nivel"] == 1 and "texto" not in regs[0]


def test_feedback(client):
    r = client.post("/assistente/perguntar", json={"pergunta": "de quem é a calçada?"}).json()
    f = client.post("/feedback", json={"alvo": "assistente", "id": r["id"], "util": True})
    assert f.status_code == 201
    assert client.post("/feedback", json={"alvo": "outro", "id": "x", "util": True}).status_code == 422


def test_assistente_guardrail_antes_do_rag(client):
    r = client.post("/assistente/perguntar", json={"pergunta": "meu marido me bate"}).json()
    assert r["modelo"] == "guardrail" and "180" in r["resposta"]


def test_confianca_media_nao_pede_confirmacao(client):
    r = client.post("/reportes/analisar", json={"descricao": "Cabo pendurado na frente de casa"}).json()
    assert 0.5 <= r["confianca"] < 0.8 and r["precisa_confirmar"] is False


def test_voz_rejeita_formato_e_aceita_historico(client):
    assert client.post("/voz/conversar", files={"audio": ("a.txt", b"x", "text/plain")}).status_code == 415
    hist = '[{"papel": "cidadao", "texto": "oi"}]'
    r = client.post("/voz/conversar", files={"audio": ("a.webm", b"123", "audio/webm;codecs=opus")}, data={"historico": hist})
    assert r.status_code == 200


def test_obter_ocorrencia_por_id(client):
    h = _login(client)
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    assert client.get(f"/ocorrencias/{o['id']}").json()["status"] == "pendente_envio"
    client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"}, headers=h)
    assert client.get(f"/ocorrencias/{o['id']}").json()["status"] == "resolvida"
    assert client.get("/ocorrencias/nao-existe").status_code == 404
    assert client.get("/ocorrencias/metricas", headers=h).status_code == 200


def test_assistente_devolve_guardrail_na_emergencia(client):
    r = client.post("/assistente/perguntar", json={"pergunta": "a casa do vizinho está pegando fogo", "historico": []}).json()
    assert r["guardrail"]["nivel"] == 1 and r["guardrail"]["canal_principal"]["numero"] == "193"
    r = client.post("/assistente/perguntar", json={"pergunta": "meu marido me bate, o que eu faço?", "historico": []}).json()
    assert r["guardrail"]["saida_rapida"] is True
    r = client.post("/assistente/perguntar", json={"pergunta": "quem conserta buraco na rua?", "historico": []}).json()
    assert r["guardrail"] is None


def test_voz_aceita_audio_do_iphone(client):
    r = client.post("/voz/conversar", files={"audio": ("fala.mp4", b"\x00" * 1000, "audio/mp4")})
    assert r.status_code == 200 and r.json()["transcricao"]
    assert client.post("/voz/conversar", files={"audio": ("x.txt", b"oi", "text/plain")}).status_code == 415


# ---------- v0.8 (F3: console) ----------

def _login_como(client, usuario):
    r = client.post("/auth/login", json={"usuario": usuario, "senha": "demo-123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_listas_exigem_login(client):
    assert client.get("/ocorrencias").status_code == 401
    assert client.get("/ocorrencias/metricas").status_code == 401
    assert client.get("/qualidade").status_code == 401
    assert client.get("/ocorrencias", headers=_login(client)).status_code == 200


def test_gestor_so_altera_o_proprio_orgao(client, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "GESTORES", ["marina:demo-123:subprefeitura:Marina", "joao:demo-123:sabesp:João"])
    o = client.post("/ocorrencias", json={"descricao": "buraco grande", "localizacao": SE, "categoria_final": "buraco"}).json()
    joao = _login_como(client, "joao")  # Sabesp
    assert client.get("/ocorrencias", headers=joao).status_code == 200  # vê tudo
    r = client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"}, headers=joao)
    assert r.status_code == 403
    assert client.patch(f"/ocorrencias/{o['id']}/status", json={"status": "resolvida"}, headers=_login(client)).status_code == 200


def test_qualidade_agrega_numeros(client):
    from pathlib import Path
    foto = (Path(__file__).parent / "fixtures" / "rua_rdd2022.jpg").read_bytes()
    client.post("/visao/detectar", files={"foto": ("f.jpg", foto, "image/jpeg")})
    client.post("/feedback", json={"alvo": "reporte", "id": "x", "util": True})
    client.post("/feedback", json={"alvo": "assistente", "id": "y", "util": False})
    client.post("/reportes/analisar", json={"descricao": "a casa está pegando fogo"})
    q = client.get("/qualidade", headers=_login(client)).json()
    assert q["visao"]["chamadas"] == 1 and q["visao"]["latencia_media_ms"] is not None
    assert q["feedback"]["reporte"] == {"util": 1, "total": 1} and q["feedback"]["assistente"]["util"] == 0
    assert q["guardrail"][0]["nivel"] == 1 and q["guardrail"][0]["total"] == 1
    assert "texto" not in str(q)  # só números


def test_onibus_passa_e_nao_ve_mais_vira_possivelmente_resolvida(client):
    from datetime import timedelta
    t0 = datetime.now(timezone.utc) - timedelta(days=1)
    trajeto = [[SE["lat"], SE["lon"] - 0.002], [SE["lat"], SE["lon"] + 0.002]]
    det = {"detectada_em": t0.isoformat(), "lat": SE["lat"], "lon": SE["lon"],
           "deteccao": {"classe": "D40", "categoria_id": "buraco", "confianca": 0.8, "bbox": [0, 0, 1, 1]}}
    client.post("/frota/passagens", json={"linha_onibus": "1", "inicio": t0.isoformat(), "fim": t0.isoformat(),
                                          "trajeto": trajeto, "deteccoes": [det]})
    t1 = datetime.now(timezone.utc).isoformat()
    r = client.post("/frota/passagens", json={"linha_onibus": "1", "inicio": t1, "fim": t1, "trajeto": trajeto, "deteccoes": []}).json()
    assert r["possivelmente_resolvidas"] == 1
    o = client.get("/ocorrencias", headers=_login(client)).json()[0]
    assert o["status"] == "possivelmente_resolvida"
    # trajeto longe (outra rua, ~200 m) não mexe em nada
    longe = [[SE["lat"] + 0.002, SE["lon"] - 0.002], [SE["lat"] + 0.002, SE["lon"] + 0.002]]
    assert client.post("/frota/passagens", json={"linha_onibus": "2", "inicio": t1, "fim": t1, "trajeto": longe, "deteccoes": []}).json()["possivelmente_resolvidas"] == 0

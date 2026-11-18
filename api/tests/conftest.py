import os

os.environ["SEED_OCORRENCIAS"] = "0"  # testes começam com o banco vazio
# Memória por padrão. Para rodar os mesmos testes no Postgres: TEST_DATABASE_URL=postgresql://... pytest
# (use um banco só de teste: limpar() apaga as ocorrências).
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "")
# Testes nunca chamam IA paga, seja qual for o api/.env (cada teste que precisa de outro modo usa monkeypatch).
os.environ["LLM_PROVIDER"] = "mock"
os.environ["RAG_PROVIDER"] = "mock"
os.environ["VISAO_RESERVA"] = "off"
os.environ["VOZ_PROVIDER"] = "mock"  # voz real só em test_voz_real.py, com componentes falsos (nunca chama o LLM pago)
os.environ["VOZ_AQUECER"] = "0"      # não carrega Whisper/MiniLM/Piper nos testes
os.environ["SUPABASE_URL"] = ""  # fotos sempre na memória nos testes (o Supabase Storage é simulado em test_fotos.py)
os.environ["DISTRITOS_BAIXAR"] = "0"  # malha do IBGE nunca baixada nos testes (simulada em test_distritos.py)
os.environ["GEO_PROVIDER"] = "mock"  # endereço sem internet nos testes (o Nominatim é simulado em test_geo.py)

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import armazenamento, repositorio


@pytest.fixture
def client():
    with TestClient(app) as c:
        repositorio.limpar()
        armazenamento.atual = armazenamento.Memoria()
        yield c

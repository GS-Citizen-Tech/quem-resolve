import os

os.environ["SEED_OCORRENCIAS"] = "0"  # testes começam com o banco vazio
# Memória por padrão. Para rodar os mesmos testes no Postgres: TEST_DATABASE_URL=postgresql://... pytest
# (use um banco só de teste: limpar() apaga as ocorrências).
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "")
os.environ["SUPABASE_URL"] = ""  # fotos sempre na memória nos testes (o Supabase Storage é simulado em test_fotos.py)

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

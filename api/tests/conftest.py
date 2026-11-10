import os

os.environ["SEED_OCORRENCIAS"] = "0"  # testes começam com o banco vazio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import repositorio


@pytest.fixture
def client():
    repositorio.limpar()
    with TestClient(app) as c:
        yield c

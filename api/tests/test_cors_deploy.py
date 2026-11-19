"""Deploy (18/11): CORS aceita a lista fixa e, com CORS_REGEX, os links da Vercel do projeto; recusa o resto."""
import importlib

from fastapi.testclient import TestClient


def _cliente(monkeypatch, regex: str | None):
    if regex:
        monkeypatch.setenv("CORS_REGEX", regex)
    else:
        monkeypatch.delenv("CORS_REGEX", raising=False)
    from app import config, main
    importlib.reload(config)
    importlib.reload(main)
    return TestClient(main.app)


def _preflight(c: TestClient, origem: str):
    return c.options("/health", headers={"Origin": origem, "Access-Control-Request-Method": "GET"})


def test_regex_aceita_vercel_do_projeto(monkeypatch):
    c = _cliente(monkeypatch, r"^https://quem-resolve[a-z0-9-]*\.vercel\.app$")
    for ok in ("https://quem-resolve.vercel.app", "https://quem-resolve-git-main-gs-citizen-tech.vercel.app", "http://localhost:3000"):
        assert _preflight(c, ok).headers.get("access-control-allow-origin") == ok
    for ruim in ("https://outro-site.vercel.app", "https://quem-resolve.vercel.app.golpe.com", "http://quem-resolve.vercel.app"):
        assert "access-control-allow-origin" not in _preflight(c, ruim).headers


def test_sem_regex_so_a_lista(monkeypatch):
    c = _cliente(monkeypatch, None)
    assert "access-control-allow-origin" not in _preflight(c, "https://quem-resolve.vercel.app").headers

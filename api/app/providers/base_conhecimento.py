"""Acesso à base 'Quem resolve o quê'. Hoje lê o JSON versionado; depois pode ler do Supabase."""
import json
from functools import lru_cache
from pathlib import Path

from app.schemas.base import Categoria, Responsavel

ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "quem_resolve.json"


@lru_cache
def _carregar() -> dict:
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


@lru_cache
def categorias() -> dict[str, Categoria]:
    return {c["id"]: Categoria(**c) for c in _carregar()["categorias"]}


@lru_cache
def responsaveis() -> dict[str, Responsavel]:
    return {r["id"]: Responsavel(**r) for r in _carregar()["responsaveis"]}


def categoria(cid: str | None) -> Categoria | None:
    return categorias().get(cid) if cid else None


def responsavel_de(cid: str | None) -> Responsavel | None:
    cat = categoria(cid)
    return responsaveis().get(cat.responsavel_id) if cat else None


def categoria_por_classe_visao(classe: str) -> Categoria | None:
    for c in categorias().values():
        if classe in c.classes_visao:
            return c
    return None

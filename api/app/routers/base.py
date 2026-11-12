from fastapi import APIRouter

from app import config
from app.providers import base_conhecimento as base
from app.providers import armazenamento, repositorio
from app.schemas.base import Categoria, Responsavel

router = APIRouter(tags=["base"])


@router.get("/health")
def health() -> dict:
    """Status e qual implementação (mock ou real) cada módulo está usando."""
    return {"status": "ok", "modulos": {
        "llm": config.LLM_PROVIDER, "visao": config.VISAO_PROVIDER,
        "rag": config.RAG_PROVIDER, "voz": config.VOZ_PROVIDER, "banco": repositorio.nome(),
        "fotos": armazenamento.atual.nome,
    }, "banco": repositorio.saude()}


@router.get("/categorias", response_model=list[Categoria])
def listar_categorias():
    return list(base.categorias().values())


@router.get("/responsaveis", response_model=list[Responsavel])
def listar_responsaveis():
    return list(base.responsaveis().values())

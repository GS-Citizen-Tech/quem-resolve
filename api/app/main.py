"""API do Quem Resolve. Rodar: uvicorn app.main:app --reload (dentro de api/)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.pipelines import simulacao
from app.providers import repositorio
from app.routers import assistente, base, cidadao, conta, integracoes, ocorrencias


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not repositorio.ocorrencias() and config.SEED_OCORRENCIAS:
        simulacao.gerar(config.SEED_OCORRENCIAS)
        simulacao.gerar_frota()
    yield


app = FastAPI(title="Quem Resolve? API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,  # nunca "*" (exigência da disciplina 04)
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)
for r in (base.router, cidadao.router, ocorrencias.router, assistente.router, integracoes.router, conta.router):
    app.include_router(r)

"""API do Quem Resolve. Rodar: uvicorn app.main:app --reload (dentro de api/)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

from app import config
from app.pipelines import simulacao
from app.providers import armazenamento, repositorio
from app.routers import assistente, base, cidadao, conta, integracoes, ocorrencias

log = logging.getLogger("quem-resolve")


@asynccontextmanager
async def lifespan(_: FastAPI):
    repositorio.preparar()  # Postgres: migrações + base + gestores. Memória: nada.
    armazenamento.atual.preparar()  # Supabase: cria o bucket privado se faltar
    if config.SEED_OCORRENCIAS and not repositorio.ocorrencias(limite=1):
        log.info("Banco vazio: criando %s ocorrências simuladas e 3 passagens da frota.", config.SEED_OCORRENCIAS)
        simulacao.gerar(config.SEED_OCORRENCIAS)
        simulacao.gerar_frota()
        repositorio.marcar_simuladas()
    yield


app = FastAPI(title="Quem Resolve? API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,  # nunca "*" (exigência da disciplina 04)
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(DBAPIError)
async def banco_fora(_: Request, erro: DBAPIError):
    """Banco caiu ou não respondeu: 503 com mensagem simples (o front mostra "Tentar de novo"). Detalhe só no log."""
    log.error("Erro no banco: %s", erro.__class__.__name__, exc_info=erro)
    return JSONResponse(status_code=503, content={"detail": "Banco de dados indisponível agora. Tente de novo em instantes."})


for r in (base.router, cidadao.router, ocorrencias.router, assistente.router, integracoes.router, conta.router):
    app.include_router(r)

"""API do Quem Resolve. Rodar: uvicorn app.main:app --reload (dentro de api/)."""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

from app import config
from app.pipelines import simulacao
from app.providers import armazenamento, distritos, repositorio, voz
from app.routers import assistente, base, cidadao, conta, geo, integracoes, ocorrencias

log = logging.getLogger("quem-resolve")


def _trocar_simulacao() -> None:
    try:
        feito = simulacao.atualizar_se_preciso(config.SEED_OCORRENCIAS)
        if feito:
            log.warning("Simulação: %s.", feito)
    except Exception:  # noqa: BLE001 - dado de exemplo nunca derruba a API; tenta de novo na próxima subida
        log.exception("Simulação: não deu para trocar os dados de exemplo agora.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    repositorio.preparar()  # Postgres: migrações + base + gestores. Memória: nada.
    armazenamento.atual.preparar()  # Supabase: cria o bucket privado se faltar
    if config.SEED_OCORRENCIAS:
        # Dados de exemplo: cria no banco vazio e troca sozinho os de uma versão antiga (só os simulados).
        # Em segundo plano: com o banco na nuvem a troca leva alguns minutos e não pode segurar a subida da API.
        threading.Thread(target=_trocar_simulacao, name="simulacao", daemon=True).start()
    distritos.garantir_em_segundo_plano()  # 1ª subida: baixa os bairros do IBGE sem atrasar a API
    if config.VOZ_PROVIDER == "real" and config.VOZ_AQUECER:
        voz.aquecer_em_segundo_plano()  # Whisper + MiniLM + Piper levam ~20 s para carregar; a API já atende enquanto isso
    yield


app = FastAPI(title="Quem Resolve? API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,  # nunca "*" (exigência da disciplina 04)
    allow_origin_regex=config.CORS_REGEX,  # só os links da Vercel deste projeto (prévias)
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(DBAPIError)
async def banco_fora(_: Request, erro: DBAPIError):
    """Banco caiu ou não respondeu: 503 com mensagem simples (o front mostra "Tentar de novo"). Detalhe só no log."""
    log.error("Erro no banco: %s", erro.__class__.__name__, exc_info=erro)
    return JSONResponse(status_code=503, content={"detail": "Banco de dados indisponível agora. Tente de novo em instantes."})


for r in (base.router, cidadao.router, ocorrencias.router, assistente.router, integracoes.router, conta.router, geo.router):
    app.include_router(r)

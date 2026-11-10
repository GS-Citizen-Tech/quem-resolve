import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.providers import auth, repositorio
from app.schemas.auth import LoginEntrada, Sessao
from app.schemas.feedback import FeedbackEntrada, FeedbackRecebido

router = APIRouter(tags=["login e feedback"])


@router.post("/auth/login", response_model=Sessao)
def login(dados: LoginEntrada):
    sessao = auth.autenticar(dados.usuario, dados.senha)
    if not sessao:
        raise HTTPException(401, "Usuário ou senha incorretos.")
    return sessao


@router.post("/feedback", response_model=FeedbackRecebido, status_code=201)
def feedback(dados: FeedbackEntrada):
    """'Isso ajudou?' do cidadão (sem dado pessoal)."""
    f = {"id": str(uuid.uuid4()), "recebido_em": datetime.now(timezone.utc), **dados.model_dump()}
    repositorio.salvar_feedback(f)
    return f

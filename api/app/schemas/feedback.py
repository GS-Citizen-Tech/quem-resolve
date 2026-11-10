"""Contrato L: "Isso ajudou?" (HITL do cidadão)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FeedbackEntrada(BaseModel):
    alvo: Literal["reporte", "assistente"]
    id: str = Field(min_length=1, max_length=64)
    util: bool
    comentario: str | None = Field(default=None, max_length=300)


class FeedbackRecebido(BaseModel):
    id: str
    recebido_em: datetime

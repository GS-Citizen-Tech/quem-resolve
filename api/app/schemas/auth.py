"""Contrato M: login de demonstração do gestor."""
from datetime import datetime

from pydantic import BaseModel, Field


class LoginEntrada(BaseModel):
    usuario: str = Field(min_length=1, max_length=50)
    senha: str = Field(min_length=1, max_length=100)


class Sessao(BaseModel):
    token: str
    nome: str
    orgao_id: str
    expira_em: datetime

"""Contrato das ocorrências: confirmação do cidadão (HITL), console da gestão e RPA."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .base import Localizacao, Origem

Status = Literal["pendente_envio", "enviada", "possivelmente_resolvida", "resolvida"]


class OcorrenciaCriar(BaseModel):
    descricao: str = Field(min_length=5, max_length=1000)
    localizacao: Localizacao
    categoria_sugerida: str | None = None
    confianca: float = Field(default=0, ge=0, le=1)
    categoria_final: str = Field(description="Categoria confirmada ou corrigida pelo cidadão")
    foto_url: str | None = Field(default=None, description="Ignorado no POST do cidadão (v0.9): use foto_base64")
    foto_base64: str | None = Field(default=None, max_length=11_200_000,
                                    description="v0.9: foto reduzida (JPEG/PNG/WEBP, até 8 MB). A API borra e guarda no Storage privado")


class Ocorrencia(BaseModel):
    id: str
    protocolo: str
    criada_em: datetime
    descricao: str
    lat: float
    lon: float
    categoria_sugerida: str | None
    confianca: float
    categoria_final: str
    responsavel_id: str
    corrigida_pelo_cidadao: bool
    status: Status
    prioridade: int = Field(ge=1, le=5)
    origem: Origem
    grupo_duplicata_id: str | None = None
    foto_url: str | None = None
    corrigida_pelo_gestor: bool = False


class HistoricoItem(BaseModel):
    """v0.9: uma mudança na ocorrência (status ou categoria), com quem fez."""
    em: datetime
    quem: str = Field(description="Nome do gestor, \"Robô RPA\" ou \"Ônibus linha X\"")
    campo: Literal["status", "categoria"]
    de: str | None
    para: str | None
    observacao: str | None = None


class AtualizarStatus(BaseModel):
    """Gestor muda o status e/ou reclassifica (HITL do gestor). Pelo menos um dos dois."""
    status: Status | None = None
    categoria_final: str | None = None
    observacao: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _algum_campo(self):
        if self.status is None and self.categoria_final is None:
            raise ValueError("Informe status ou categoria_final")
        return self

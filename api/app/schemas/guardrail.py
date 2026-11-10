"""Contrato do guardrail de segurança (PRD 4.2). Usado por Front, GenAI e PLN."""
from typing import Literal

from pydantic import BaseModel, Field

Camada = Literal["regras", "llm", "visao"]


class CanalEmergencia(BaseModel):
    nome: str
    numero: str
    quando: str


class GuardrailEntrada(BaseModel):
    texto: str = Field(min_length=1, max_length=2000)


class GuardrailResultado(BaseModel):
    nivel: Literal[0, 1, 2, 3] = Field(description="0 = sem risco; 1 = risco imediato; 2 = violência sem risco imediato; 3 = zeladoria com risco")
    tipo: str | None = Field(default=None, description="ex.: fogo, gas, pessoa_ferida, violencia_domestica, fio_faiscando")
    camada: Camada | None = None
    justificativa: str | None = None
    canal_principal: CanalEmergencia | None = None
    outros_canais: list[CanalEmergencia] = []
    pode_continuar: bool = Field(description="True quando o cidadão pode seguir com o reporte (nível 0 ou 3)")
    saida_rapida: bool = Field(default=False, description="Mostrar botão de saída rápida (violência doméstica)")

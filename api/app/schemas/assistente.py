"""Contrato do assistente RAG (GenAI, disciplina 05, parceiro). O assistente de voz reaproveita."""
import uuid
from typing import Literal

from pydantic import BaseModel, Field

from .base import Fonte
from .guardrail import GuardrailResultado


class Mensagem(BaseModel):
    papel: Literal["cidadao", "assistente"]
    texto: str = Field(max_length=2000)


class PerguntaEntrada(BaseModel):
    pergunta: str = Field(min_length=3, max_length=1000)
    historico: list[Mensagem] = Field(default_factory=list, max_length=20)


class RespostaAssistente(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Para receber feedback (POST /feedback)")
    resposta: str
    fontes: list[Fonte]
    sem_fonte: bool = Field(description="True quando não há base para responder (o assistente diz que não sabe)")
    fora_do_tema: bool = False
    modelo: str
    guardrail: GuardrailResultado | None = Field(
        default=None, description="Resultado do guardrail quando nível > 0 (v0.7): o front mostra a tela de emergência ou o aviso de risco")

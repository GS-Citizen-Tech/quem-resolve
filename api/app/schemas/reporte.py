"""Contrato do reporte do cidadão (Front, disciplina 04): entrada → IA → resposta útil."""
from typing import Literal

from pydantic import BaseModel, Field

from .base import Categoria, Fonte, Localizacao, Responsavel
from .guardrail import GuardrailResultado
from .visao import Deteccao


class ReporteEntrada(BaseModel):
    descricao: str = Field(min_length=5, max_length=1000)
    localizacao: Localizacao | None = None
    deteccoes_visao: list[Deteccao] = Field(default_factory=list, description="Resultado prévio de /visao/detectar, se houver foto")


class AnaliseLLM(BaseModel):
    """Saída estruturada exigida do LLM (o front nunca chama o LLM direto)."""
    categoria_id: str | None
    confianca: float = Field(ge=0, le=1)
    explicacao: str = Field(max_length=400, description="Explicação curta em linguagem simples")


class AnaliseReporte(BaseModel):
    guardrail: GuardrailResultado
    categoria: Categoria | None
    responsavel: Responsavel | None
    confianca: float = Field(ge=0, le=1)
    precisa_confirmar: bool = Field(description="True quando a confiança é baixa e o cidadão deve escolher/confirmar")
    explicacao: str
    proximo_passo: str
    classificado_por: Literal["regras", "llm", "visao", "nenhum"]
    alternativas: list[Categoria] = Field(default_factory=list, description="Outras categorias prováveis para o botão 'Não é isso'")
    fontes: list[Fonte] = []

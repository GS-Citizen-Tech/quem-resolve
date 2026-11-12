"""Contrato da tela "Qualidade da IA" do console (v0.8). Só números agregados, nenhum texto de cidadão."""
from pydantic import BaseModel


class QualidadeVisao(BaseModel):
    chamadas: int
    latencia_media_ms: float | None
    latencia_p95_ms: float | None
    por_origem: dict[str, int]  # yolo | multimodal | nenhuma


class QualidadeClassificacao(BaseModel):
    total: int
    confianca_media: float | None
    baixa_confianca: int  # confiança < 0,5 ainda não revisada pelo gestor
    corrigidas_pelo_cidadao: int
    corrigidas_pelo_gestor: int


class QualidadeFeedback(BaseModel):
    util: int
    total: int


class QualidadeGuardrail(BaseModel):
    nivel: int
    total: int
    nao_e_emergencia: int


class Qualidade(BaseModel):
    modulos: dict[str, str]
    visao: QualidadeVisao
    classificacao: QualidadeClassificacao
    feedback: dict[str, QualidadeFeedback]  # reporte | assistente
    guardrail: list[QualidadeGuardrail]

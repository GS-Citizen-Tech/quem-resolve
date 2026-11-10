"""Contrato da Visão Computacional (disciplina 09, Ian). Usado pelo app e pela frota."""
from pydantic import BaseModel, Field


class Deteccao(BaseModel):
    classe: str = Field(description="Classe do modelo, ex.: D00, D10, D20, D40 (RDD2022), garbage")
    categoria_id: str | None = Field(default=None, description="Categoria do Quem Resolve mapeada a partir da classe")
    confianca: float = Field(ge=0, le=1)
    bbox: tuple[float, float, float, float] = Field(description="x1, y1, x2, y2 normalizados (0 a 1)")


class VisaoResultado(BaseModel):
    deteccoes: list[Deteccao]
    modelo: str = Field(description="ex.: mock, yolov8n-rdd2022")
    latencia_ms: float

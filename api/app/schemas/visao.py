"""Contrato da Visão Computacional (disciplina 09, Ian). Usado pelo app e pela frota."""
from typing import Literal

from pydantic import BaseModel, Field


class Deteccao(BaseModel):
    classe: str = Field(description="Classe do modelo: D00, D10, D20, D40 (YOLO RDD2022) ou o id da categoria (multimodal)")
    categoria_id: str | None = Field(default=None, description="Categoria do Quem Resolve mapeada a partir da classe")
    confianca: float = Field(ge=0, le=1)
    bbox: tuple[float, float, float, float] | None = Field(
        default=None, description="x1, y1, x2, y2 normalizados (0 a 1). Sempre presente no YOLO; opcional no multimodal")
    origem: Literal["yolo", "multimodal"] = Field(
        default="yolo", description="yolo = detector treinado (pavimento); multimodal = reserva para as outras categorias")
    descricao: str | None = Field(default=None, max_length=200, description="Frase curta do multimodal sobre o que viu")


class VisaoResultado(BaseModel):
    deteccoes: list[Deteccao]
    modelo: str = Field(description="ex.: mock, yolov8n-rdd2022-r2, ou 'yolov8n-rdd2022-r2 + gemini-3.5-flash' quando a reserva entrou")
    latencia_ms: float

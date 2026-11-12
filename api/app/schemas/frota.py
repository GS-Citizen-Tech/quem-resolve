"""Contrato da frota (VC + Cluster, Ian): o processador em lote envia detecções já borradas."""
from datetime import datetime

from pydantic import BaseModel, Field

from .visao import Deteccao


class DeteccaoFrota(BaseModel):
    detectada_em: datetime
    lat: float
    lon: float
    deteccao: Deteccao
    recorte_url: str | None = Field(default=None, description="Recorte já borrado; vídeo bruto nunca é enviado")


class PassagemFrota(BaseModel):
    linha_onibus: str
    inicio: datetime
    fim: datetime
    trajeto: list[tuple[float, float]] = Field(description="Lista de (lat, lon) do GPS")
    deteccoes: list[DeteccaoFrota]
    fps_processamento: float | None = None


class ResultadoIngestao(BaseModel):
    passagem_id: str
    novas_ocorrencias: int
    associadas_a_existentes: int
    possivelmente_resolvidas: int = Field(default=0, description="Problemas abertos por onde o ônibus passou sem vê-los de novo (v0.8)")

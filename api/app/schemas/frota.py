"""Contrato da frota (VC + Cluster, Ian): o processador em lote envia detecções já borradas."""
from datetime import datetime
from typing import Literal

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


class DanoProcessado(BaseModel):
    id: int
    classe: str
    dano: str | None = None
    quadros: int
    conf_max: float
    t_s: float
    lat: float
    lon: float


class Processamento(BaseModel):
    """Vídeo curto ou fotos enviados pelo gestor na tela "Frota" (v1.0), processados em segundo plano."""
    id: str
    status: Literal["na_fila", "processando", "concluido", "erro"]
    criado_em: datetime
    enviado_por: str
    linha_onibus: str
    tipo: Literal["video", "fotos"]
    arquivos: int
    nome: str = Field(description="Nome do vídeo ou da 1ª foto")
    progresso: float = Field(0, ge=0, le=1)
    quadros_processados: int = 0
    quadros_total: int = 0
    mensagem: str | None = Field(default=None, description="Aviso (ex.: vídeo cortado em 60 s) ou o motivo do erro")
    resultado: ResultadoIngestao | None = None
    metricas: dict | None = Field(default=None, description="FPS, latências, danos únicos, regiões borradas (resumo do metricas.json)")
    danos: list[DanoProcessado] = []
    video_disponivel: bool = False
    video_tipo: str | None = Field(default=None, description="video/webm (toca no navegador) ou video/mp4")

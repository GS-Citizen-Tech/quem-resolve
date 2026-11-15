"""Endereço por extenso (contrato O, v1.1): o que o cidadão vê em "Você está em …"."""
from pydantic import BaseModel, Field


class Endereco(BaseModel):
    texto_curto: str = Field(description='Rua e número, ex.: "Rua Augusta, 900"')
    bairro: str | None = None
    cidade: str | None = None
    rua: str | None = None
    numero: str | None = None
    fonte: str = "OpenStreetMap"


class Distrito(BaseModel):
    id: str = Field(description='Ex.: "itaquera"')
    nome: str


class ResultadoBusca(BaseModel):
    texto_curto: str
    bairro: str | None = None
    cidade: str | None = None
    lat: float
    lon: float

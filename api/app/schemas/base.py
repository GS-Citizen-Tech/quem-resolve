from typing import Literal

from pydantic import BaseModel, Field

Emergencia = Literal["sim", "nao", "depende"]
Origem = Literal["cidadao", "frota", "ambos"]


class Responsavel(BaseModel):
    id: str
    nome: str
    canal: str
    contato: str
    url: str | None = None


class Categoria(BaseModel):
    id: str
    nome: str
    responsavel_id: str
    emergencia: Emergencia
    palavras: list[str] = Field(default_factory=list, description="Palavras-chave usadas pelo classificador por regras")
    classes_visao: list[str] = Field(default_factory=list, description="Classes do detector de visão que mapeiam para esta categoria")


class Fonte(BaseModel):
    titulo: str
    url: str | None = None
    trecho: str | None = None


class Localizacao(BaseModel):
    lat: float = Field(ge=-24.1, le=-23.3, description="Limitado à Grande São Paulo")
    lon: float = Field(ge=-47.0, le=-46.3)

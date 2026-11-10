from pydantic import BaseModel


class Contagem(BaseModel):
    chave: str
    total: int


class Metricas(BaseModel):
    total: int
    por_categoria: list[Contagem]
    por_responsavel: list[Contagem]
    por_origem: list[Contagem]
    pct_fora_prefeitura: float
    taxa_correcao_cidadao: float

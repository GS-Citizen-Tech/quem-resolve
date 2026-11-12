"""Criação de ocorrências (HITL), deduplicação e prioridade. Usado por cidadão e frota."""
import math
import uuid
from datetime import datetime, timezone

from app.providers import base_conhecimento as base
from app.providers import repositorio
from app.schemas.base import Origem
from app.schemas.ocorrencia import Ocorrencia, OcorrenciaCriar

RAIO_DUPLICATA_M = 50


def distancia_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _prioridade(categoria_id: str, tamanho_grupo: int, origem: Origem) -> int:
    cat = base.categoria(categoria_id)
    p = 2 + {"sim": 2, "depende": 1, "nao": 0}[cat.emergencia]
    if tamanho_grupo >= 3 or origem == "ambos":
        p += 1
    return min(p, 5)


def duplicata_de(categoria_id: str, lat: float, lon: float) -> Ocorrencia | None:
    for o in repositorio.ocorrencias(categoria=categoria_id):
        if o.status != "resolvida" and distancia_m(lat, lon, o.lat, o.lon) <= RAIO_DUPLICATA_M:
            return o
    return None


def _novo_protocolo() -> str:
    return f"QR-{datetime.now():%y%m%d}-{uuid.uuid4().hex[:5].upper()}"


def registrar(dados: OcorrenciaCriar, origem: Origem = "cidadao", criada_em: datetime | None = None) -> Ocorrencia:
    if dados.categoria_final not in base.categorias():
        raise ValueError(f"Categoria desconhecida: {dados.categoria_final}")
    lat, lon = dados.localizacao.lat, dados.localizacao.lon
    existente = duplicata_de(dados.categoria_final, lat, lon)
    grupo = None
    if existente:
        grupo = existente.grupo_duplicata_id or existente.id
        if existente.origem != origem:
            existente.origem = "ambos"
        existente.grupo_duplicata_id = grupo
        repositorio.salvar_ocorrencia(existente)  # entra no grupo antes da contagem abaixo
    tamanho = 1 + (len(repositorio.ocorrencias(grupo=grupo)) if grupo else 0)
    o = Ocorrencia(
        id=str(uuid.uuid4()),
        protocolo=_novo_protocolo(),
        criada_em=criada_em or datetime.now(timezone.utc),
        descricao=dados.descricao,
        lat=lat,
        lon=lon,
        categoria_sugerida=dados.categoria_sugerida,
        confianca=dados.confianca,
        categoria_final=dados.categoria_final,
        responsavel_id=base.categoria(dados.categoria_final).responsavel_id,
        corrigida_pelo_cidadao=bool(dados.categoria_sugerida and dados.categoria_sugerida != dados.categoria_final),
        status="pendente_envio",
        prioridade=1,
        origem=origem if not existente or existente.origem != "ambos" else "ambos",
        grupo_duplicata_id=grupo,
        foto_url=dados.foto_url,
    )
    o.prioridade = _prioridade(o.categoria_final, tamanho, o.origem)
    if existente and o.prioridade > existente.prioridade:
        existente.prioridade = o.prioridade
        repositorio.salvar_ocorrencia(existente)
    return repositorio.salvar_ocorrencia(o)


def filtrar(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
            status: str | None = None, limite: int | None = None) -> list[Ocorrencia]:
    return repositorio.ocorrencias(categoria=categoria, responsavel=responsavel, origem=origem, status=status, limite=limite)

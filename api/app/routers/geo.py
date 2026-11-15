"""Contrato O (v1.1): endereço por extenso para o cidadão ver onde o reporte vai ficar."""
from fastapi import APIRouter, HTTPException, Query

from app.providers import geocodificacao as geo
from app.schemas.geo import Endereco, ResultadoBusca

router = APIRouter(prefix="/geo", tags=["cidadão"])

FORA = "Esse ponto fica fora da Grande São Paulo."
INDISPONIVEL = "Não consegui buscar o endereço agora."


@router.get("/endereco", response_model=Endereco)
def endereco(lat: float = Query(ge=geo.LAT_MIN, le=geo.LAT_MAX, description=FORA),
             lon: float = Query(ge=geo.LON_MIN, le=geo.LON_MAX, description=FORA)):
    try:
        r = geo.atual.endereco(lat, lon)
    except geo.ErroGeo:
        raise HTTPException(503, INDISPONIVEL)
    if r is None:
        raise HTTPException(404, "Não achei um endereço para esse ponto.")
    return r


@router.get("/buscar", response_model=list[ResultadoBusca])
def buscar(q: str = Query(min_length=3, max_length=120)):
    try:
        return geo.atual.buscar(q.strip())
    except geo.ErroGeo:
        raise HTTPException(503, INDISPONIVEL)

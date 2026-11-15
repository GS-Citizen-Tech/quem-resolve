"""Contrato O (v1.1): endereço por extenso para o cidadão ver onde o reporte vai ficar."""
from fastapi import APIRouter, HTTPException, Query

from fastapi.responses import JSONResponse

from app.providers import distritos
from app.providers import geocodificacao as geo
from app.schemas.geo import Distrito, Endereco, ResultadoBusca

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


@router.get("/distritos", response_model=list[Distrito])
def listar_distritos():
    """v1.3: os 96 distritos de São Paulo (id e nome), em ordem alfabética."""
    distritos.garantir()  # primeira vez: baixa do IBGE (ou espera o download da subida terminar)
    return [Distrito(id=i, nome=n) for i, n in distritos.lista()]


@router.get("/distritos.geojson")
def malha_distritos():
    """v1.3: fronteiras simplificadas (IBGE) para pintar o mapa do console. Pode ficar em cache no navegador por 1 dia."""
    distritos.garantir()
    dados = distritos.geojson()
    if not dados["features"]:
        raise HTTPException(503, "Os bairros ainda não carregaram: o IBGE não respondeu. Tente de novo em 2 minutos.")
    return JSONResponse(dados, headers={"Cache-Control": "public, max-age=86400"})

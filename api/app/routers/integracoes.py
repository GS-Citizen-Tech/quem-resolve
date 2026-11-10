from fastapi import APIRouter, Depends

from app.pipelines import frota, iot
from app.providers import repositorio
from app.providers.auth import exigir_gestor
from app.schemas.frota import PassagemFrota, ResultadoIngestao
from app.schemas.iot import EventoSom, EventoSomEntrada

router = APIRouter(tags=["frota e IoT"])


@router.post("/frota/passagens", response_model=ResultadoIngestao, status_code=201)
def ingerir_passagem(p: PassagemFrota):
    """Recebe o lote processado de um trajeto de ônibus (VC + Cluster)."""
    return frota.ingerir(p)


@router.get("/frota/passagens")
def listar_passagens() -> dict:
    return repositorio.passagens()


@router.post("/iot/eventos", response_model=EventoSom, status_code=201)
def evento_som(e: EventoSomEntrada):
    """Recebe a classificação do Edge Impulse (OuviAí) feita no celular."""
    return iot.processar(e)


@router.get("/iot/eventos", response_model=list[EventoSom])
def listar_eventos(limite: int = 20):
    return repositorio.eventos_som()[:limite]


@router.get("/guardrail/registros")
def registros_guardrail(_: dict = Depends(exigir_gestor)) -> list[dict]:
    """Registro anônimo de acionamentos (D08), para a área de qualidade da IA."""
    return repositorio.registros_guardrail()

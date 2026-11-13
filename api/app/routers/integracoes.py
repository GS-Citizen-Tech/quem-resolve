from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app import config
from app.pipelines import frota, iot, processamentos, qualidade
from app.providers import repositorio
from app.providers.auth import exigir_gestor
from app.schemas.frota import PassagemFrota, Processamento, ResultadoIngestao
from app.schemas.iot import EventoSom, EventoSomEntrada
from app.schemas.qualidade import Qualidade

router = APIRouter(tags=["frota e IoT"])


@router.post("/frota/passagens", response_model=ResultadoIngestao, status_code=201)
def ingerir_passagem(p: PassagemFrota):
    """Recebe o lote processado de um trajeto de ônibus (VC + Cluster)."""
    return frota.ingerir(p)


@router.get("/frota/passagens")
def listar_passagens() -> dict:
    return repositorio.passagens()


async def _gravar(arquivo: UploadFile, destino: Path, max_bytes: int):
    """Grava o upload em pedaços, parando assim que passar do limite (não lê o arquivo inteiro na memória)."""
    lidos = 0
    with destino.open("wb") as f:
        while pedaco := await arquivo.read(1024 * 1024):
            lidos += len(pedaco)
            if lidos > max_bytes:
                raise HTTPException(413, f"{arquivo.filename}: passou de {max_bytes // (1024 * 1024)} MB.")
            f.write(pedaco)
    if lidos == 0:
        raise HTTPException(422, f"{arquivo.filename}: arquivo vazio.")


@router.post("/frota/processamentos", response_model=Processamento, status_code=202)
async def enviar_processamento(arquivos: list[UploadFile] = File(..., description="1 vídeo curto OU várias fotos em ordem"),
                               linha_onibus: str = Form("8000-10", max_length=20),
                               gpx: UploadFile | None = File(None, description="Trajeto GPS opcional; sem ele, trajeto simulado"),
                               gestor: dict = Depends(exigir_gestor)):
    """v1.0: o gestor envia um vídeo curto (até 60 s analisados) ou uma sequência de fotos pela tela Frota.
    Responde na hora (202) e processa em segundo plano; acompanhe em GET /frota/processamentos/{id}."""
    tipos = {processamentos.tipo_do_arquivo(a.filename or "") for a in arquivos}
    if None in tipos or len(tipos) != 1:
        raise HTTPException(422, "Envie um vídeo (MP4, MOV, WebM) ou só fotos (JPG, PNG, WebP), sem misturar.")
    tipo = tipos.pop()
    if tipo == "video" and len(arquivos) > 1:
        raise HTTPException(422, "Envie um vídeo por vez.")
    if tipo == "fotos" and len(arquivos) > config.FROTA_MAX_FOTOS:
        raise HTTPException(422, f"No máximo {config.FROTA_MAX_FOTOS} fotos por envio.")
    if processamentos.ocupado() >= 3:
        raise HTTPException(429, "Já há 3 processamentos na fila. Espere um terminar.")
    job, pasta = processamentos.criar(gestor["u"], linha_onibus.strip() or "8000-10", tipo, [a.filename for a in arquivos])
    try:
        for i, a in enumerate(arquivos):  # prefixo numérico: as fotos entram na ordem em que foram escolhidas
            nome = f"{i:03d}{Path(a.filename).suffix.lower()}"
            await _gravar(a, pasta / "entrada" / nome, config.FROTA_MAX_MB * 1024 * 1024 if tipo == "video" else 8 * 1024 * 1024)
        caminho_gpx = None
        if gpx is not None and gpx.filename:
            caminho_gpx = pasta / "trajeto.gpx"
            await _gravar(gpx, caminho_gpx, 5 * 1024 * 1024)
    except HTTPException:
        processamentos.descartar(job.id)
        raise
    processamentos.iniciar(job.id, caminho_gpx)
    return processamentos.obter(job.id)


@router.get("/frota/processamentos", response_model=list[Processamento])
def listar_processamentos(_: dict = Depends(exigir_gestor)):
    return processamentos.listar()


@router.get("/frota/processamentos/{pid}", response_model=Processamento)
def obter_processamento(pid: str, _: dict = Depends(exigir_gestor)):
    job = processamentos.obter(pid)
    if not job:
        raise HTTPException(404, "Processamento não encontrado (a API pode ter reiniciado).")
    return job


@router.get("/frota/processamentos/{pid}/video", response_class=FileResponse)
def video_processamento(pid: str, _: dict = Depends(exigir_gestor)):
    """Vídeo anotado e já borrado (WebM, toca no navegador). O vídeo enviado não é guardado."""
    caminho = processamentos.video(pid)
    if not caminho:
        raise HTTPException(404, "Vídeo anotado não disponível.")
    tipo = "video/webm" if caminho.suffix == ".webm" else "video/mp4"
    return FileResponse(caminho, media_type=tipo, filename=f"frota-{pid}{caminho.suffix}")


@router.post("/iot/eventos", response_model=EventoSom, status_code=201)
def evento_som(e: EventoSomEntrada):
    """Recebe a classificação do Edge Impulse (OuviAí) feita no celular."""
    return iot.processar(e)


@router.get("/iot/eventos", response_model=list[EventoSom])
def listar_eventos(limite: int = 20):
    return repositorio.eventos_som(limite=min(limite, 200))


@router.get("/guardrail/registros")
def registros_guardrail(_: dict = Depends(exigir_gestor)) -> list[dict]:
    """Registro anônimo de acionamentos (D08), para a área de qualidade da IA."""
    return repositorio.registros_guardrail()


@router.get("/qualidade", response_model=Qualidade)
def obter_qualidade(_: dict = Depends(exigir_gestor)):
    """Números da tela "Qualidade da IA" (v0.8): visão, classificação, "Isso ajudou?" e guardrail. Só agregados."""
    return qualidade.calcular()

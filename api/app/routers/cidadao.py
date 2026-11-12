from fastapi import APIRouter, File, HTTPException, UploadFile

from app.pipelines import analise_reporte, guardrail
from app.providers import repositorio
from app.providers.visao import ImagemInvalida, detectar_cidadao
from app.schemas.guardrail import GuardrailEntrada, GuardrailResultado
from app.schemas.reporte import AnaliseReporte, ReporteEntrada
from app.schemas.visao import VisaoResultado

router = APIRouter(tags=["cidadão"])

TIPOS_IMAGEM = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGEM = 8 * 1024 * 1024


@router.post("/guardrail/avaliar", response_model=GuardrailResultado)
def avaliar_guardrail(entrada: GuardrailEntrada):
    return guardrail.avaliar(entrada.texto)


@router.post("/guardrail/nao-e-emergencia", status_code=204)
def nao_e_emergencia(nivel: int, tipo: str | None = None):
    """Registro anônimo quando o cidadão toca 'não é uma emergência' (D08)."""
    repositorio.registrar_guardrail(nivel, tipo, "regras", nao_e_emergencia=True)


@router.post("/visao/detectar", response_model=VisaoResultado)
async def detectar(foto: UploadFile = File(...)):
    if foto.content_type not in TIPOS_IMAGEM:
        raise HTTPException(415, "Envie uma foto JPG, PNG ou WEBP.")
    dados = await foto.read()
    if len(dados) > MAX_IMAGEM:
        raise HTTPException(413, "A foto passa de 8 MB.")
    try:
        r = detectar_cidadao(dados)
    except ImagemInvalida:
        raise HTTPException(422, "Não consegui ler a foto. Tente tirar outra.")
    origem = "multimodal" if any(d.origem == "multimodal" for d in r.deteccoes) else ("yolo" if r.deteccoes else "nenhuma")
    repositorio.registrar_visao(r.latencia_ms, origem)  # só números, para a tela de qualidade (v0.8)
    return r


@router.post("/reportes/analisar", response_model=AnaliseReporte)
def analisar(entrada: ReporteEntrada):
    return analise_reporte.analisar(entrada)

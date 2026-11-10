import json
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import TypeAdapter, ValidationError

from app.pipelines import guardrail
from app.providers.rag import obter_rag
from app.providers.voz import obter_voz
from app.schemas.assistente import Mensagem, PerguntaEntrada, RespostaAssistente
from app.schemas.voz import Latencias, RespostaVoz

router = APIRouter(tags=["assistente"])

TIPOS_AUDIO = {"audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg"}
MAX_AUDIO = 2 * 1024 * 1024  # ~1 min de webm/opus
_HIST = TypeAdapter(list[Mensagem])


def para_fala(texto: str) -> str:
    """Adapta a resposta para TTS (RF63). O parceiro (PLN) evolui esta função."""
    return texto.replace("SP156", "S P cento e cinquenta e seis").replace("*", "").replace("#", "")


@router.post("/assistente/perguntar", response_model=RespostaAssistente)
def perguntar(entrada: PerguntaEntrada):
    g = guardrail.avaliar(entrada.pergunta)
    if not g.pode_continuar:  # nível 1 ou 2: o RAG nem é chamado
        return RespostaAssistente(resposta=f"Isso parece uma emergência. Ligue {g.canal_principal.numero}, {g.canal_principal.nome}.",
                                  fontes=[], sem_fonte=True, modelo="guardrail")
    return obter_rag().responder(entrada.pergunta, entrada.historico)


@router.post("/voz/conversar", response_model=RespostaVoz)
async def conversar(audio: UploadFile = File(...), historico: str | None = Form(default=None)):
    """STT → (guardrail) → RAG → TTS. O áudio é descartado após a transcrição (RF66)."""
    if (audio.content_type or "").split(";")[0] not in TIPOS_AUDIO:
        raise HTTPException(415, "Envie o áudio em webm, wav, mp3 ou ogg.")
    dados = await audio.read()
    if len(dados) > MAX_AUDIO:
        raise HTTPException(413, "O áudio passa do limite de 1 minuto.")
    try:
        hist = _HIST.validate_python(json.loads(historico)) if historico else []
    except (ValueError, ValidationError):
        raise HTTPException(422, "Histórico inválido.")
    voz = obter_voz()
    t0 = time.perf_counter()
    transcricao = voz.transcrever(dados)
    del dados  # o áudio não é guardado
    t1 = time.perf_counter()
    g = guardrail.avaliar(transcricao)
    if not g.pode_continuar:
        resposta = RespostaAssistente(resposta=f"Isso parece uma emergência. Ligue {g.canal_principal.numero}, {g.canal_principal.nome}.",
                     fontes=[], sem_fonte=True, modelo="guardrail")
    else:
        resposta = obter_rag().responder(transcricao, hist[-20:])
    t2 = time.perf_counter()
    falado = para_fala(resposta.resposta)
    audio_b64 = voz.sintetizar(falado)
    t3 = time.perf_counter()
    ms = lambda a, b: round((b - a) * 1000, 1)  # noqa: E731
    return RespostaVoz(transcricao=transcricao, resposta=resposta, texto_falado=falado, audio_base64=audio_b64,
                       latencias=Latencias(stt_ms=ms(t0, t1), llm_ms=ms(t1, t2), tts_ms=ms(t2, t3), total_ate_fala_ms=ms(t0, t3)))

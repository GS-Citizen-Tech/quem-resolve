"""Contrato do assistente de voz (PLN, disciplina 08, parceiro): STT → LLM/RAG → TTS."""
from pydantic import BaseModel

from .assistente import RespostaAssistente


class Latencias(BaseModel):
    stt_ms: float
    llm_ms: float
    tts_ms: float
    total_ate_fala_ms: float


class RespostaVoz(BaseModel):
    transcricao: str
    resposta: RespostaAssistente
    texto_falado: str
    audio_base64: str | None = None
    latencias: Latencias

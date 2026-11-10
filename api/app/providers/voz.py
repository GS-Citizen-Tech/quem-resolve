"""Acesso ao pipeline de voz (disciplina 08, parceiro): STT e TTS.

O mock não transcreve áudio de verdade: devolve uma pergunta fixa para o fluxo
STT → RAG → TTS já funcionar no front. O módulo real usa faster-whisper e edge-tts/Piper.
"""
from typing import Protocol

from app import config


class Voz(Protocol):
    def transcrever(self, audio: bytes) -> str: ...
    def sintetizar(self, texto: str) -> str | None: ...


class MockVoz:
    def transcrever(self, audio: bytes) -> str:
        return "Tem um fio pendurado na frente da minha casa, quem eu chamo?"

    def sintetizar(self, texto: str) -> str | None:
        return None  # sem áudio no mock; o front usa a fala do navegador como fallback


def obter_voz() -> Voz:
    if config.VOZ_PROVIDER == "mock":
        return MockVoz()
    raise NotImplementedError(f"Voz '{config.VOZ_PROVIDER}' ainda não implementada")

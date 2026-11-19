"""Acesso ao pipeline de voz (disciplina 08, parceiro): STT, resposta (RAG + LLM), adaptação para fala e TTS.

- `MockVoz`: não transcreve áudio de verdade; devolve uma pergunta fixa e deixa a resposta com o assistente do chat.
- `RealVoz` (`VOZ_PROVIDER=real`): o módulo de PLN em `app/pipelines/voz/` (faster-whisper → RAG MiniLM →
  LLM compatível com OpenAI → adaptação para fala → Piper). O guardrail continua sendo o da API e roda antes
  (no router), então `responder` só é chamado quando o guardrail deixa continuar (nível 0 ou 3).

Privacidade (RF66 / LGPD): o áudio é transcrito direto da memória, sem arquivo em disco; o WAV da resposta é
lido e apagado na hora. Nada de texto ou áudio vai para log.
"""
import base64
import io
import logging
import os
import threading
from pathlib import Path
from typing import Protocol

from app import config
from app.pipelines.texto import normalizar
from app.schemas.assistente import Mensagem, RespostaAssistente
from app.schemas.base import Fonte

log = logging.getLogger(__name__)
API_DIR = Path(__file__).resolve().parents[2]
BASE_VOZ = API_DIR / "app" / "data" / "voz"
RAG_MODELO = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

MSG_NAO_OUVI = "Desculpe, não consegui entender o áudio. Pode falar de novo, um pouco mais perto do microfone?"
MSG_ERRO_LLM = "Desculpe, estou com um problema para responder agora. Enquanto isso, você pode ligar para o SP156 no 156."
# Frases que indicam que o LLM recusou por estar fora do tema (RF67). Mesmas do módulo de PLN.
MARCAS_RECUSA = ["so consigo ajudar", "so posso ajudar", "so ajudo", "nao posso ajudar", "nao consigo ajudar",
                 "fora do", "nao e um assunto", "apenas com problemas", "somente com problemas",
                 "infelizmente nao", "nao tenho como"]


class Voz(Protocol):
    nome: str

    def transcrever(self, audio: bytes) -> str: ...
    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente | None: ...
    def para_fala(self, texto: str) -> str: ...
    def sintetizar(self, texto: str) -> str | None: ...


def parece_recusa(texto: str) -> bool:
    t = normalizar(texto)
    return any(m in t for m in MARCAS_RECUSA)


class MockVoz:
    nome = "mock"

    def transcrever(self, audio: bytes) -> str:
        return "Tem um fio pendurado na frente da minha casa, quem eu chamo?"

    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente | None:
        return None  # None = o router usa o assistente do chat (obter_rag)

    def para_fala(self, texto: str) -> str:
        return texto.replace("SP156", "S P cento e cinquenta e seis").replace("*", "").replace("#", "")

    def sintetizar(self, texto: str) -> str | None:
        return None  # sem áudio no mock; o front usa a fala do navegador como fallback


class RealVoz:
    """Módulo de PLN ligado na API. Os componentes carregam sob demanda e podem ser injetados nos testes."""

    nome = "real"

    def __init__(self, stt=None, rag=None, llm=None, tts=None):
        self._stt, self._rag, self._llm, self._tts = stt, rag, llm, tts
        self._trava = threading.Lock()  # o aquecimento (thread da subida) e o 1º pedido não carregam o modelo 2 vezes

    # ---------- componentes (lazy) ----------
    @property
    def stt(self):
        with self._trava:
            if self._stt is None:
                from app.pipelines.voz.stt import TranscritorWhisper
                self._stt = TranscritorWhisper(config.VOZ_STT_MODELO, config.VOZ_STT_DEVICE)
            return self._stt

    @property
    def rag(self):
        with self._trava:
            if self._rag is None:
                from app.pipelines.voz.rag import BaseConhecimento
                self._rag = BaseConhecimento(BASE_VOZ, RAG_MODELO, top_k=3, limiar=config.VOZ_RAG_LIMIAR)
            return self._rag

    @property
    def llm(self):
        with self._trava:
            if self._llm is None:
                from app.pipelines.voz.llm import ClienteLLM
                self._llm = ClienteLLM(config.VOZ_LLM_BASE_URL, config.VOZ_LLM_API_KEY, config.VOZ_LLM_MODELO,
                                       temperatura=0.2, max_tokens=300)
            return self._llm

    @property
    def tts(self):
        if config.VOZ_TTS_MOTOR == "off":
            return None
        with self._trava:
            if self._tts is None:
                from app.pipelines.voz.tts import criar_sintetizador
                piper = Path(config.VOZ_PIPER_VOZ)
                piper = piper if piper.is_absolute() else API_DIR / piper
                self._tts = criar_sintetizador(config.VOZ_TTS_MOTOR, str(piper), config.VOZ_EDGE_VOZ)
            return self._tts

    def aquecer(self) -> None:
        """Carrega os modelos e roda uma inferência de cada (a 1ª é bem mais lenta). O LLM não é chamado (cota).
        Com RAG_PROVIDER=real o cérebro é o RAG de GenAI, aquecido à parte (providers/rag.py)."""
        if config.RAG_PROVIDER != "real":
            _ = self.llm
            self.rag.buscar("buraco na rua")
        if self.tts is not None:
            caminho = self.tts.sintetizar("Olá, tudo bem? Tem um buraco na minha rua.")
            try:
                self.stt.transcrever(caminho)
            finally:
                _apagar(caminho)
        else:
            _ = self.stt

    # ---------- etapas ----------
    def transcrever(self, audio: bytes) -> str:
        # faster-whisper aceita arquivo em memória: o áudio do cidadão nunca vai para o disco.
        return self.stt.transcrever(io.BytesIO(audio)).strip()

    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente:
        from app.pipelines.voz.memoria import memoria_de_historico
        from app.pipelines.voz.prompts import montar_mensagens

        modelo = f"{getattr(self._llm, 'nome', config.VOZ_LLM_MODELO)} + MiniLM-L12 multilíngue"
        if not pergunta.strip():
            return RespostaAssistente(resposta=MSG_NAO_OUVI, fontes=[], sem_fonte=True, modelo=modelo)
        if config.RAG_PROVIDER == "real":
            # Cérebro da voz = RAG de GenAI (disciplina 05), o mesmo do chat. STT, adaptação para fala e TTS seguem do PLN.
            from app.providers.rag import obter_rag
            return obter_rag().responder(pergunta, historico)

        mem = memoria_de_historico([m.model_dump() for m in historico], config.VOZ_MEMORIA_TURNOS)
        achados = self.rag.buscar(pergunta, mem.ultima_pergunta())
        mensagens = montar_mensagens(mem.mensagens(), achados, pergunta)
        try:
            texto = self.llm.responder(mensagens)
        except Exception as e:  # noqa: BLE001 - LLM fora do ar, sem cota ou modelo descontinuado: caminho seguro
            log.error("LLM da voz falhou: %s", e.__class__.__name__, exc_info=e)
            texto = ""
        if not texto:
            return RespostaAssistente(resposta=MSG_ERRO_LLM, fontes=[], sem_fonte=True, modelo=modelo)

        fontes = [Fonte(titulo=f"{d.fonte} - {d.titulo}" if d.fonte else d.titulo, url=d.fonte_url or None,
                        trecho=d.texto[:300]) for d, _ in achados]
        return RespostaAssistente(resposta=texto, fontes=fontes, sem_fonte=not achados,
                                  fora_do_tema=parece_recusa(texto), modelo=modelo)

    def para_fala(self, texto: str) -> str:
        from app.pipelines.voz.adaptacao_fala import adaptar_para_fala
        return adaptar_para_fala(texto)

    def sintetizar(self, texto: str) -> str | None:
        tts = self.tts
        if tts is None or not texto:
            return None
        caminho = None
        try:
            caminho = tts.sintetizar(texto)
            return base64.b64encode(Path(caminho).read_bytes()).decode()
        except Exception as e:  # noqa: BLE001 - sem áudio o front usa a voz do navegador
            log.error("TTS falhou: %s", e.__class__.__name__, exc_info=e)
            return None
        finally:
            if caminho:
                _apagar(caminho)


def _apagar(caminho: str) -> None:
    try:
        os.remove(caminho)
    except OSError:
        pass


_real: RealVoz | None = None


def obter_voz() -> Voz:
    global _real
    if config.VOZ_PROVIDER == "mock":
        return MockVoz()
    if config.VOZ_PROVIDER == "real":
        if _real is None:
            _real = RealVoz()
        return _real
    raise NotImplementedError(f"Voz '{config.VOZ_PROVIDER}' não existe (use mock ou real)")


def aquecer_em_segundo_plano() -> None:
    """Na subida da API: carrega Whisper, MiniLM e Piper sem travar o servidor."""
    def _rodar():
        try:
            log.info("Voz: carregando modelos (Whisper %s, MiniLM, %s)...", config.VOZ_STT_MODELO, config.VOZ_TTS_MOTOR)
            obter_voz().aquecer()
            log.info("Voz: modelos prontos.")
        except Exception as e:  # noqa: BLE001
            log.error("Voz: falha ao carregar os modelos (%s). Confira requirements-voz.txt e o .env.", e, exc_info=e)
    threading.Thread(target=_rodar, name="aquecer-voz", daemon=True).start()

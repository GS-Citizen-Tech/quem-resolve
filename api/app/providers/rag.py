"""Acesso ao assistente RAG (disciplina 05, parceiro).

- `MockRAG`: procura a pergunta na base 'Quem resolve o quê' e cita a regra como fonte (testes, sem modelos).
- `RealRAG` (`RAG_PROVIDER=real`): o pipeline do notebook GS-GENAI-CITIZENTECH portado para `app/pipelines/rag/`
  (chunking estrutural, BM25 + multilingual-e5-small com RRF, reranker mMiniLM, gate de similaridade, Gemini com
  JSON em esquema, sanitização, máscara de PII e pós-validação das citações). Base: app/data/voz (a mesma da voz).

O chat (`POST /assistente/perguntar`) e a voz (`POST /voz/conversar`, com VOZ_PROVIDER=real) usam o mesmo RAG.
Contrato G sem mudança: o status do pipeline vira `sem_fonte` / `fora_do_tema` e as citações viram `fontes`.
"""
import logging
import threading
from pathlib import Path
from typing import Protocol

from app import config
from app.providers import base_conhecimento as base
from app.schemas.assistente import Mensagem, RespostaAssistente
from app.schemas.base import Fonte

log = logging.getLogger(__name__)
BASE_RAG = Path(__file__).resolve().parents[1] / "data" / "voz"


class RAG(Protocol):
    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente: ...


class MockRAG:
    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente:
        texto = pergunta.lower()
        for cat in base.categorias().values():
            if any(p in texto for p in cat.palavras):
                resp = base.responsaveis()[cat.responsavel_id]
                return RespostaAssistente(
                    resposta=f"{cat.nome}: quem resolve é {resp.nome}. Canal: {resp.canal} ({resp.contato}).",
                    fontes=[Fonte(titulo="Base Quem Resolve v0 (a validar)", url=resp.url, trecho=cat.nome)],
                    sem_fonte=False,
                    modelo="mock-rag",
                )
        return RespostaAssistente(
            resposta="Não encontrei isso na minha base. Para ter certeza, ligue 156 ou acesse o SP156.",
            fontes=[],
            sem_fonte=True,
            modelo="mock-rag",
        )


def _nome_curto(modelo: str) -> str:
    return modelo.rsplit("/", 1)[-1]


class RealRAG:
    """Monta o pipeline sob demanda (E5 + reranker levam ~10 s para carregar). Peças injetáveis nos testes."""

    def __init__(self, assistente=None):
        self._assistente = assistente
        self._trava = threading.Lock()

    @property
    def assistente(self):
        with self._trava:
            if self._assistente is None:
                from app.pipelines.rag.corpus import carregar_documentos, chunk_estrutural
                from app.pipelines.rag.gerador import GeminiGerador
                from app.pipelines.rag.pipeline import AssistenteRAG
                from app.pipelines.rag.recuperacao import Indice
                from app.pipelines.rag.seguranca import sanitizar

                trechos = chunk_estrutural(carregar_documentos(BASE_RAG))
                sanitizar(trechos)
                quarentena = [t.id for t in trechos if t.quarentena]
                if quarentena:
                    log.warning("RAG: %d trecho(s) em quarentena: %s", len(quarentena), quarentena)
                indice = Indice(trechos, config.RAG_EMBEDDINGS, config.RAG_RERANKER or None, n_cand=config.RAG_CANDIDATOS)
                gerador = GeminiGerador(config.RAG_LLM_MODELO, config.RAG_LLM_API_KEY, config.RAG_LLM_TIMEOUT)
                self._assistente = AssistenteRAG(indice, gerador, top_k=config.RAG_TOP_K, limiar=config.RAG_LIMIAR)
                log.info("RAG: %d trechos indexados (%s).", len(indice.trechos), config.RAG_EMBEDDINGS)
            return self._assistente

    def aquecer(self) -> None:
        a = self.assistente
        a.indice.max_sim("buraco na rua")
        a.indice.buscar("buraco na rua", 1)

    def responder(self, pergunta: str, historico: list[Mensagem]) -> RespostaAssistente:
        try:
            a = self.assistente
        except Exception as e:  # noqa: BLE001 - sem modelos ou sem chave: o cidadão recebe o 156, nunca um erro
            log.error("RAG indisponível: %s", e)
            from app.pipelines.rag.pipeline import MSG_FALHA_LLM
            return RespostaAssistente(resposta=MSG_FALHA_LLM, fontes=[], sem_fonte=True, modelo="rag-indisponivel")
        r = a.responder(pergunta, [(m.papel, m.texto) for m in historico])
        partes = [_nome_curto(r.modelo), _nome_curto(config.RAG_EMBEDDINGS)]
        if config.RAG_RERANKER:
            partes.append("rerank")
        fontes = [Fonte(titulo=f"{t.fonte} - {t.titulo}" if t.fonte else t.titulo, url=t.url or None, trecho=t.texto[:300])
                  for t in r.trechos_citados]
        return RespostaAssistente(
            resposta=r.resposta,
            fontes=fontes,
            sem_fonte=r.status in ("sem_evidencia", "fora_escopo", "recusada") or (r.status == "respondida" and not fontes),
            fora_do_tema=r.status in ("fora_escopo", "recusada"),
            modelo=" + ".join(partes),
        )


_real: RealRAG | None = None


def obter_rag() -> RAG:
    global _real
    if config.RAG_PROVIDER == "mock":
        return MockRAG()
    if config.RAG_PROVIDER == "real":
        if _real is None:
            _real = RealRAG()
        return _real
    raise NotImplementedError(f"RAG '{config.RAG_PROVIDER}' não existe (use mock ou real)")


def aquecer_em_segundo_plano() -> None:
    """Na subida da API: carrega E5 + reranker e indexa a base sem travar o servidor."""
    def _rodar():
        try:
            log.info("RAG: carregando modelos (%s, %s)...", config.RAG_EMBEDDINGS, config.RAG_RERANKER or "sem reranker")
            obter_rag().aquecer()
            log.info("RAG: pronto.")
        except Exception as e:  # noqa: BLE001
            log.error("RAG: falha ao carregar (%s). Confira requirements-rag.txt e o .env.", e, exc_info=e)
    threading.Thread(target=_rodar, name="aquecer-rag", daemon=True).start()

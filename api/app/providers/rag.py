"""Acesso ao assistente RAG (disciplina 05, parceiro).

O mock só procura a pergunta na base 'Quem resolve o quê' e cita a regra como fonte.
O RAG real (chunking, embeddings, pgvector, LLM) entra numa classe nova com o mesmo
método `responder`, sem mudar o router nem o front.
"""
from typing import Protocol

from app import config
from app.providers import base_conhecimento as base
from app.schemas.assistente import Mensagem, RespostaAssistente
from app.schemas.base import Fonte


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


def obter_rag() -> RAG:
    if config.RAG_PROVIDER == "mock":
        return MockRAG()
    raise NotImplementedError(f"RAG '{config.RAG_PROVIDER}' ainda não implementado")

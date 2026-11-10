"""Acesso ao LLM. Só o back-end fala com o provedor; a saída é sempre um modelo Pydantic.

Para ligar um LLM real: implemente `classificar` numa classe nova (ex.: GeminiLLM),
pedindo JSON no formato de `AnaliseLLM`, valide com `AnaliseLLM.model_validate_json`
e registre em `obter_llm`.
"""
from typing import Protocol

from app import config
from app.providers import base_conhecimento as base
from app.schemas.reporte import AnaliseLLM


class ErroLLM(Exception):
    """Falha do provedor (fora do ar, timeout, resposta inválida)."""


class LLM(Protocol):
    nome: str

    def classificar(self, descricao: str, categorias_ids: list[str]) -> AnaliseLLM: ...


class MockLLM:
    """Simula o LLM com sobreposição de palavras. Determinístico, sem custo, bom para testes."""

    nome = "mock-llm"

    def classificar(self, descricao: str, categorias_ids: list[str]) -> AnaliseLLM:
        texto = descricao.lower()
        melhor, pontos = None, 0
        for cid in categorias_ids:
            cat = base.categoria(cid)
            p = sum(1 for palavra in cat.palavras for parte in palavra.split() if len(parte) > 3 and parte in texto)
            if p > pontos:
                melhor, pontos = cid, p
        if not melhor:
            return AnaliseLLM(categoria_id=None, confianca=0.2, explicacao="Não consegui identificar o tipo de problema.")
        return AnaliseLLM(
            categoria_id=melhor,
            confianca=min(0.55 + 0.1 * pontos, 0.85),
            explicacao=f"Pela descrição, parece ser: {base.categoria(melhor).nome}.",
        )


def obter_llm() -> LLM:
    if config.LLM_PROVIDER == "mock":
        return MockLLM()
    raise ErroLLM(f"Provedor de LLM '{config.LLM_PROVIDER}' ainda não implementado")

"""Armazenamento da API (fachada). Sem DATABASE_URL: memória (app/db/memoria.py), a API sobe sem banco.
Com DATABASE_URL: Postgres/Supabase (app/db/postgres.py). As duas têm as mesmas funções:

  ciclo de vida   preparar, saude, marcar_simuladas, limpar (testes)
  ocorrências     salvar_ocorrencia (cria ou atualiza), ocorrencia, ocorrencias(filtros), registrar_historico, historico
  frota           salvar_passagem(pid, dados, deteccoes), passagens, deteccoes
  IoT e medições  salvar_evento_som, eventos_som, registrar_guardrail, registros_guardrail, salvar_feedback, feedbacks,
                  registrar_visao, chamadas_visao, registrar_voz, latencias_voz
  gestores        gestor(usuario) → {usuario, nome, orgao_id, senha_hash, ativo}

Importante: o que vem daqui é uma cópia. Mudou um campo? Chame salvar_ocorrencia de novo.
"""
from types import ModuleType

from app import config


def _escolher() -> ModuleType:
    if config.DATABASE_URL:
        from app.db import postgres
        return postgres
    from app.db import memoria
    return memoria


_impl = _escolher()


def nome() -> str:
    """"memoria" ou "postgres" (vai no /health e na tela de qualidade)."""
    return _impl.NOME


def __getattr__(funcao: str):
    return getattr(_impl, funcao)

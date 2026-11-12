"""Armazenamento em memória: a API sobe sem banco (sem DATABASE_URL) e os testes rodam rápido.
Mesmas funções de app/db/postgres.py; a fachada é app/providers/repositorio.py."""
from collections import Counter
from datetime import date, datetime, timezone

import bcrypt

from app import config
from app.schemas.iot import EventoSom
from app.schemas.ocorrencia import Ocorrencia

NOME = "memoria"

_ocorrencias: dict[str, Ocorrencia] = {}
_historico: list[dict] = []
_eventos_som: list[EventoSom] = []
_passagens: dict[str, dict] = {}
_deteccoes: list[dict] = []
_feedbacks: list[dict] = []
_visao: list[tuple[float, str]] = []  # (latência ms, origem: yolo | multimodal | nenhuma), sem imagem
_voz: list[dict] = []
_guardrail: Counter = Counter()  # registro anônimo (D08): só (data, nível, tipo, camada, nao_e_emergencia)
_hashes: dict[tuple[str, str], str] = {}  # (usuario, senha do .env) → hash, para não refazer o bcrypt a cada login


# ---------- Ciclo de vida ----------

def preparar() -> None:
    """Nada a migrar em memória."""


def saude() -> str:
    return "ok"


def marcar_simuladas() -> None:
    """Em memória tudo some ao reiniciar; não precisa marcar."""


def limpar() -> None:
    for x in (_ocorrencias, _historico, _eventos_som, _passagens, _deteccoes, _feedbacks, _visao, _voz, _guardrail):
        x.clear()


# ---------- Ocorrências ----------

def salvar_ocorrencia(o: Ocorrencia) -> Ocorrencia:
    _ocorrencias[o.id] = o.model_copy()
    return o


def ocorrencia(oid: str) -> Ocorrencia | None:
    o = _ocorrencias.get(oid)
    return o.model_copy() if o else None  # cópia: quem chama precisa salvar o que mudar (igual ao Postgres)


def ocorrencias(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
                status: str | None = None, grupo: str | None = None, limite: int | None = None) -> list[Ocorrencia]:
    res = [o for o in _ocorrencias.values()
           if (not categoria or o.categoria_final == categoria) and (not responsavel or o.responsavel_id == responsavel)
           and (not origem or o.origem == origem) and (not status or o.status == status)
           and (not grupo or o.grupo_duplicata_id == grupo)]
    res.sort(key=lambda o: o.criada_em, reverse=True)
    return [o.model_copy() for o in res[:limite]]


def registrar_historico(oid: str, quem: str, campo: str, de: str | None, para: str | None,
                        observacao: str | None = None) -> None:
    _historico.append({"ocorrencia_id": oid, "em": datetime.now(timezone.utc), "quem": quem, "campo": campo,
                       "de": de, "para": para, "observacao": observacao})


def historico(oid: str) -> list[dict]:
    return [{k: v for k, v in h.items() if k != "ocorrencia_id"} for h in _historico if h["ocorrencia_id"] == oid]


# ---------- Frota ----------

def salvar_passagem(pid: str, dados: dict, deteccoes: list[dict] | None = None) -> None:
    _passagens[pid] = dados
    _deteccoes.extend({**d, "passagem_id": pid} for d in deteccoes or [])


def passagens() -> dict[str, dict]:
    return dict(_passagens)


def deteccoes(passagem_id: str) -> list[dict]:
    return [d for d in _deteccoes if d["passagem_id"] == passagem_id]


# ---------- IoT ----------

def salvar_evento_som(e: EventoSom) -> EventoSom:
    _eventos_som.append(e)
    del _eventos_som[:-200]
    return e


def eventos_som(limite: int = 200) -> list[EventoSom]:
    return list(reversed(_eventos_som))[:limite]


# ---------- Medições anônimas ----------

def registrar_guardrail(nivel: int, tipo: str | None, camada: str | None, nao_e_emergencia: bool = False) -> None:
    _guardrail[(date.today().isoformat(), nivel, tipo, camada, nao_e_emergencia)] += 1


def registros_guardrail() -> list[dict]:
    return [{"data": d, "nivel": n, "tipo": t, "camada": c, "nao_e_emergencia": ne, "total": tot}
            for (d, n, t, c, ne), tot in _guardrail.items()]


def salvar_feedback(f: dict) -> dict:
    _feedbacks.append(f)
    return f


def feedbacks() -> list[dict]:
    return list(_feedbacks)


def registrar_visao(latencia_ms: float, origem: str) -> None:
    _visao.append((latencia_ms, origem))
    del _visao[:-1000]


def chamadas_visao() -> list[tuple[float, str]]:
    return list(_visao)


def registrar_voz(stt_ms: float, llm_ms: float, tts_ms: float, total_ms: float, provedor: str) -> None:
    _voz.append({"stt_ms": stt_ms, "llm_ms": llm_ms, "tts_ms": tts_ms, "total_ms": total_ms, "provedor": provedor})
    del _voz[:-1000]


def latencias_voz() -> list[dict]:
    return list(_voz)


# ---------- Gestores ----------

def gestor(usuario: str) -> dict | None:
    """Sem banco, os gestores vêm do GESTORES do .env (lido a cada login); a senha vira hash bcrypt na memória."""
    for item in config.GESTORES:
        partes = item.split(":")
        if len(partes) == 4 and partes[0] == usuario:
            _, senha, orgao, nome = partes
            if (usuario, senha) not in _hashes:
                _hashes[(usuario, senha)] = bcrypt.hashpw(senha.encode(), bcrypt.gensalt(rounds=10)).decode()
            return {"usuario": usuario, "nome": nome, "orgao_id": orgao, "senha_hash": _hashes[(usuario, senha)], "ativo": True}
    return None

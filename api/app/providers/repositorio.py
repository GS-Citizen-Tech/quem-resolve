"""Armazenamento. Hoje em memória (o protótipo sobe sem banco);
depois troca por Supabase/Postgres mantendo as mesmas funções."""
from collections import Counter
from datetime import date

from app.schemas.iot import EventoSom
from app.schemas.ocorrencia import Ocorrencia

_ocorrencias: dict[str, Ocorrencia] = {}
_eventos_som: list[EventoSom] = []
_passagens: dict[str, dict] = {}
_feedbacks: list[dict] = []
_visao: list[tuple[float, str]] = []  # (latência ms, origem: yolo | multimodal | nenhuma), sem imagem
_guardrail: Counter = Counter()  # registro anônimo (D08): só (data, nível, tipo, camada, nao_e_emergencia)


def salvar_ocorrencia(o: Ocorrencia) -> Ocorrencia:
    _ocorrencias[o.id] = o
    return o


def ocorrencia(oid: str) -> Ocorrencia | None:
    return _ocorrencias.get(oid)


def ocorrencias() -> list[Ocorrencia]:
    return sorted(_ocorrencias.values(), key=lambda o: o.criada_em, reverse=True)


def salvar_evento_som(e: EventoSom) -> EventoSom:
    _eventos_som.append(e)
    del _eventos_som[:-200]
    return e


def eventos_som() -> list[EventoSom]:
    return list(reversed(_eventos_som))


def salvar_passagem(pid: str, dados: dict) -> None:
    _passagens[pid] = dados


def passagens() -> dict[str, dict]:
    return dict(_passagens)


def registrar_guardrail(nivel: int, tipo: str | None, camada: str | None, nao_e_emergencia: bool = False) -> None:
    _guardrail[(date.today().isoformat(), nivel, tipo, camada, nao_e_emergencia)] += 1


def registros_guardrail() -> list[dict]:
    return [
        {"data": d, "nivel": n, "tipo": t, "camada": c, "nao_e_emergencia": ne, "total": tot}
        for (d, n, t, c, ne), tot in _guardrail.items()
    ]


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


def limpar() -> None:
    _visao.clear()
    _feedbacks.clear()
    _ocorrencias.clear()
    _eventos_som.clear()
    _passagens.clear()
    _guardrail.clear()

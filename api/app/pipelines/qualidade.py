"""Agrega os números de qualidade da IA para o console (v0.8)."""
from app import config
from app.providers import repositorio
from app.schemas.qualidade import (Qualidade, QualidadeClassificacao, QualidadeFeedback, QualidadeGuardrail,
                                   QualidadeVisao)


def _p95(v: list[float]) -> float | None:
    if not v:
        return None
    s = sorted(v)
    return round(s[min(len(s) - 1, int(0.95 * len(s)))], 1)


def calcular() -> Qualidade:
    vis = repositorio.chamadas_visao()
    lat = [x for x, _ in vis]
    por_origem = {k: sum(1 for _, o in vis if o == k) for k in ("yolo", "multimodal", "nenhuma")}

    oc = repositorio.ocorrencias()
    conf = [o.confianca for o in oc if o.confianca > 0]

    fb = repositorio.feedbacks()
    feedback = {alvo: QualidadeFeedback(util=sum(1 for f in fb if f["alvo"] == alvo and f["util"]),
                                        total=sum(1 for f in fb if f["alvo"] == alvo))
                for alvo in ("reporte", "assistente")}

    niveis: dict[int, list[int]] = {}
    for r in repositorio.registros_guardrail():
        t = niveis.setdefault(r["nivel"], [0, 0])
        t[0] += r["total"]
        t[1] += r["total"] if r["nao_e_emergencia"] else 0

    return Qualidade(
        modulos={"llm": config.LLM_PROVIDER, "visao": config.VISAO_PROVIDER, "visao_reserva": config.VISAO_RESERVA,
                 "rag": config.RAG_PROVIDER, "voz": config.VOZ_PROVIDER},
        visao=QualidadeVisao(chamadas=len(vis), latencia_media_ms=round(sum(lat) / len(lat), 1) if lat else None,
                             latencia_p95_ms=_p95(lat), por_origem=por_origem),
        classificacao=QualidadeClassificacao(
            total=len(oc), confianca_media=round(sum(conf) / len(conf), 3) if conf else None,
            baixa_confianca=sum(1 for o in oc if 0 < o.confianca < config.LIMIAR_CONFIANCA and not o.corrigida_pelo_gestor),
            corrigidas_pelo_cidadao=sum(1 for o in oc if o.corrigida_pelo_cidadao),
            corrigidas_pelo_gestor=sum(1 for o in oc if o.corrigida_pelo_gestor)),
        feedback=feedback,
        guardrail=[QualidadeGuardrail(nivel=n, total=t, nao_e_emergencia=ne) for n, (t, ne) in sorted(niveis.items())],
    )

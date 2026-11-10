"""Pipeline principal do cidadão: guardrail → visão → regras → LLM → roteamento."""
from app import config
from app.pipelines import guardrail
from app.pipelines.texto import normalizar
from app.providers import base_conhecimento as base
from app.providers import repositorio
from app.providers.llm import ErroLLM, obter_llm
from app.schemas.base import Fonte
from app.schemas.reporte import AnaliseReporte, ReporteEntrada


def _por_regras(descricao: str) -> list[tuple[str, int]]:
    """Ranking de categorias por número de palavras-chave encontradas."""
    t = normalizar(descricao)
    pontos = []
    for c in base.categorias().values():
        p = sum(1 for palavra in c.palavras if normalizar(palavra) in t)
        if p:
            pontos.append((c.id, p))
    return sorted(pontos, key=lambda x: -x[1])


def analisar(entrada: ReporteEntrada) -> AnaliseReporte:
    g = guardrail.avaliar(entrada.descricao)
    if g.nivel:
        repositorio.registrar_guardrail(g.nivel, g.tipo, g.camada)
    if not g.pode_continuar:
        # Níveis 1 e 2: não classifica nem guarda nada além do registro anônimo.
        return AnaliseReporte(
            guardrail=g, categoria=None, responsavel=None, confianca=0, precisa_confirmar=False,
            explicacao="Isso parece uma emergência. Procure ajuda agora pelo canal indicado.",
            proximo_passo=f"Ligue {g.canal_principal.numero} ({g.canal_principal.nome}).",
            classificado_por="nenhum",
        )

    candidatos: list[tuple[str, float, str]] = []  # (categoria, confiança, quem classificou)

    visao = [d for d in entrada.deteccoes_visao if d.categoria_id]
    if visao:
        d = max(visao, key=lambda x: x.confianca)
        candidatos.append((d.categoria_id, d.confianca, "visao"))

    regras = _por_regras(entrada.descricao)
    if regras:
        cid, p = regras[0]
        candidatos.append((cid, min(0.6 + 0.15 * p, 0.95), "regras"))

    if not candidatos or max(c[1] for c in candidatos) < config.LIMIAR_CONFIANCA:
        try:
            r = obter_llm().classificar(entrada.descricao, list(base.categorias()))
            if r.categoria_id in base.categorias():
                candidatos.append((r.categoria_id, r.confianca, "llm"))
        except ErroLLM:
            pass  # RNF06: sem IA, o cidadão escolhe a categoria manualmente

    if not candidatos:
        return AnaliseReporte(
            guardrail=g, categoria=None, responsavel=None, confianca=0, precisa_confirmar=True,
            explicacao="Não consegui identificar o problema. Escolha a categoria na lista.",
            proximo_passo="Escolha a categoria que mais se parece com o problema.",
            classificado_por="nenhum",
            alternativas=list(base.categorias().values())[:6],
        )

    # Se visão e texto concordam, a confiança sobe.
    cid, conf, origem = max(candidatos, key=lambda c: c[1])
    if len({c[0] for c in candidatos}) == 1 and len(candidatos) > 1:
        conf = min(conf + 0.1, 0.99)

    cat, resp = base.categoria(cid), base.responsavel_de(cid)
    alternativas = [base.categoria(c) for c, _ in regras if c != cid][:3]
    return AnaliseReporte(
        guardrail=g,
        categoria=cat,
        responsavel=resp,
        confianca=round(conf, 2),
        precisa_confirmar=conf < config.LIMIAR_CONFIANCA,
        explicacao=f"Isso parece ser {cat.nome.lower()}. Quem resolve: {resp.nome}.",
        proximo_passo=f"Confirme e nós geramos a solicitação para {resp.canal}.",
        classificado_por=origem,
        alternativas=alternativas,
        fontes=[Fonte(titulo="Base Quem Resolve v0 (a validar)", url=resp.url)],
    )

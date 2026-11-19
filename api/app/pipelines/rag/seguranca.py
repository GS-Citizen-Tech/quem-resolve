"""Defesas do RAG (notebook, Seções 2.1, 6 e 9).

- Sanitização na ingestão: trechos com cara de instrução ao modelo, pedido de pagamento ou fonte fora da lista
  vão para a quarentena e nunca são recuperados (defesa contra injeção indireta).
- Guarda de entrada: pergunta com tentativa de injeção ou pedido de dados de terceiros é recusada sem chamar o LLM.
- Máscara de PII: CPF, e-mail e telefone pessoal saem da pergunta, do histórico e da resposta.
- Pós-validação: citação precisa existir no contexto, número da resposta precisa estar no contexto, link só para
  domínio permitido, canário contra vazamento do prompt. Resposta reprovada vira "não encontrei" com o SP156.
"""
import re
from urllib.parse import urlparse

CANARY = "CANARIO-QR26-9B4C"  # marcador secreto no prompt: se aparecer na saída, houve vazamento

# Fontes oficiais da base. abcdoabc.com.br é um jornal que reproduz os canais oficiais da Sabesp (fonte de 2 categorias
# e do FAQ de acessibilidade); fica na lista até a base apontar para o site da Sabesp.
DOMINIOS_PADRAO = (".gov.br", ".leg.br", "enel.com.br", "comgas.com.br", "sabesp.com.br", "abcdoabc.com.br")

PADROES_INJECAO = [
    r"ignor\w*\s+(todas\s+)?(as\s+)?(instru|regras|orienta)",
    r"(atenção|atencao|nota)\s*,?\s*(assistente|ia|modelo|chatbot)",
    r"a partir de agora\s+(você|voce|informe|responda|diga)",
    r"(revel|mostr|exib)\w*\s+(o\s+|seu\s+)?(prompt|instru)",
    r"n[aã]o\s+(mencione|cite|revele)\s+(esta|essa)\s+instru",
    r"(pagar|pague|pix|transfer)\w*.{0,60}(chave|@)",
    r"(you are now|ignore (all|previous)|system prompt|jailbreak|modo dan|\bDAN\b)",
]
RE_INJECAO = re.compile("|".join(PADROES_INJECAO), re.I)
RE_DADOS_TERCEIROS = re.compile(
    r"(cpf|dados|email|e-mail|senha).{0,40}(outro|último|ultimo|anterior|outros)\s+(usu|cidad|pessoa)", re.I)

RE_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
RE_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")
# Telefone pessoal (DDD + 8 ou 9 dígitos). Não pega 156, 199, 0800 72 72 120 (números de serviço da base).
RE_TEL = re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b")
RE_DOMINIO = re.compile(
    r"\b(?:https?://)?((?:[a-z0-9-]+\.)+(?:br|com|net|org|info|io|xyz|site|online|app|link|top|invalid|me|co))\b", re.I)
RE_CITACAO = re.compile(r"\s*\[([^\]\[]+#\d+(?:\s*,\s*[^\]\[]+#\d+)*)\]")

STATUS_VALIDOS = {"respondida", "sem_evidencia", "fora_escopo", "esclarecimento", "recusada"}
MSG_NAO_CONFIRMEI = ("Não consegui confirmar essa informação nas fontes oficiais que consultei. "
                     "Para ter certeza, ligue 156 ou use o aplicativo SP156.")
MSG_LINK_EXTERNO = ("Não posso indicar sites fora dos canais oficiais. Use o SP156 (telefone 156, aplicativo ou "
                    "site sp156.prefeitura.sp.gov.br) ou o atendimento oficial da concessionária.")


def detectar_injecao(texto: str) -> list[str]:
    return [m.group(0) for m in RE_INJECAO.finditer(texto or "")]


def dominio_permitido(host: str | None, dominios=DOMINIOS_PADRAO) -> bool:
    host = (host or "").lower().strip(".")
    if host.startswith("www."):
        host = host[4:]
    return any(host == d.lstrip(".") or host.endswith(d if d.startswith(".") else "." + d) for d in dominios)


def fonte_permitida(url: str, dominios=DOMINIOS_PADRAO) -> bool:
    return dominio_permitido(urlparse(url).hostname, dominios)


def dominios_externos(texto: str, dominios=DOMINIOS_PADRAO) -> list[str]:
    """Domínios citados no texto que não estão na lista (ex.: um site de golpe)."""
    return sorted({m.group(1).lower() for m in RE_DOMINIO.finditer(texto or "") if not dominio_permitido(m.group(1), dominios)})


def sanitizar(trechos, dominios=DOMINIOS_PADRAO, filtro_fontes: bool = True) -> None:
    """Marca a quarentena em cada trecho (in place)."""
    for t in trechos:
        motivos = detectar_injecao(t.texto)
        if filtro_fontes and not fonte_permitida(t.url, dominios):
            motivos.append(f"fonte_fora_da_lista:{urlparse(t.url).hostname}")
        t.quarentena, t.motivo_quarentena = bool(motivos), motivos


def guarda_entrada(pergunta: str) -> tuple[bool, list[str]]:
    achados = detectar_injecao(pergunta)
    return bool(achados or RE_DADOS_TERCEIROS.search(pergunta)), achados


def mascarar_pii(t: str) -> str:
    t = RE_CPF.sub("[CPF REMOVIDO]", t)
    t = RE_EMAIL.sub("[EMAIL REMOVIDO]", t)
    return RE_TEL.sub("[TELEFONE REMOVIDO]", t)


def tirar_citacoes(texto: str) -> str:
    """'... no 156 [buraco#0].' -> '... no 156.' (o front mostra as fontes à parte)."""
    return re.sub(r"\s+([.,;:!?])", r"\1", RE_CITACAO.sub("", texto)).strip()


def _variantes(n: str) -> set[str]:
    """'2.766,00' -> {'276600', '2766'}: a mesma quantia com ou sem centavos."""
    return {re.sub(r"[.,]", "", n), n.split(",")[0].replace(".", "")}


def numeros(t: str, variantes: bool = True):
    t = re.sub(r"\[[^\]]+\]", " ", t)  # tira as citações [id]
    toks = [n for n in re.findall(r"\d+(?:[.,]\d+)*", t) if len(re.sub(r"[.,]", "", n)) >= 2]
    if variantes:
        return set().union(*[_variantes(n) for n in toks]) if toks else set()
    return toks


def _numeros_juntos(t: str) -> str:
    """'0800 72 72 120' e '0800-72-72-120' viram '08007272120' para comparar telefones escritos de jeitos diferentes."""
    return re.sub(r"(?<=\d)[\s.-](?=\d)", "", t)


def pos_validar(saida: dict, trechos, pergunta: str, dominios=DOMINIOS_PADRAO) -> tuple[dict, list[str]]:
    alertas: list[str] = []
    ids_ok = {t.id for t in trechos}
    cit = [x for x in saida.get("citacoes") or [] if x in ids_ok]
    for grupo in re.findall(r"\[([^\]]+)\]", saida["resposta"]):  # aceita [a#0] e [a#0, b#0]
        cit += [x.strip() for x in grupo.split(",") if x.strip() in ids_ok and x.strip() not in cit]
    if len(cit) < len(saida.get("citacoes") or []):
        alertas.append("citacao_inexistente_removida")
    saida["citacoes"] = cit

    if saida["status"] == "respondida":
        if not cit:
            alertas.append("resposta_sem_citacao")
        contexto = " ".join(t.texto for t in trechos) + " " + pergunta
        ctx = numeros(contexto) | numeros(_numeros_juntos(contexto))
        resp = saida["resposta"]
        soltos = {n for n in numeros(resp, variantes=False) if not (_variantes(n) & ctx)}
        soltos = {n for n in soltos if not any(_variantes(x) & ctx for x in numeros(_numeros_juntos(resp), False) if n in x)}
        if soltos:
            alertas.append(f"numeros_nao_sustentados:{sorted(soltos)}")
    if CANARY in saida["resposta"] or "REGRAS DE RESPOSTA" in saida["resposta"]:
        alertas.append("vazamento_prompt")
    externos = dominios_externos(saida["resposta"], dominios)
    if externos:
        alertas.append(f"link_externo:{externos}")
    saida["resposta"] = mascarar_pii(saida["resposta"])

    if any(a.startswith(("resposta_sem_citacao", "numeros_nao_sustentados", "vazamento_prompt", "link_externo"))
           for a in alertas):
        saida["status"] = "recusada" if "vazamento_prompt" in alertas else "sem_evidencia"
        saida["resposta"] = MSG_LINK_EXTERNO if externos else MSG_NAO_CONFIRMEI
        saida["citacoes"] = []
    return saida, alertas

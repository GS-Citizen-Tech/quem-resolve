"""Corpus e chunking estrutural (notebook, Seção 2: configuração escolhida `estrutural_1200_150`).

Fonte: a base "Quem resolve o quê" (`quem_resolve.json`) e o FAQ (`faq.md`) em app/data/voz, a mesma base da voz.
Cada categoria vira um documento com seções; o FAQ é dividido pelos cabeçalhos `## `. Seções curtas são juntadas
à seguinte e as longas são cortadas em janelas de 1200 caracteres com 150 de sobreposição. Cada trecho leva um
cabeçalho contextual ("Serviço / Seção") no texto indexado e todos os metadados (URL, fonte, validado).
"""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

MAX_CHARS, OVERLAP, MIN_CHARS = 1200, 150, 150


@dataclass
class Trecho:
    id: str
    doc_id: str
    titulo: str
    secao: str
    texto: str
    texto_indexado: str
    fonte: str
    url: str
    validado: bool = False
    quarentena: bool = False
    motivo_quarentena: list[str] = field(default_factory=list)


def _doc_categoria(item: dict) -> dict:
    partes = [
        f"Problema: {item['categoria']}.",
        f"Exemplos: {', '.join(item.get('exemplos', []))}.",
        f"Quem resolve: {item['responsavel']}.",
        f"Canal: {item.get('canal', '')}.",
        f"Como acionar: {item.get('como_acionar', '')}",
    ]
    if item.get("emergencia") in ("sim", "depende"):
        partes.append("Pode ser emergência." if item["emergencia"] == "sim" else "Pode ser emergência, dependendo do caso.")
    if item.get("seguranca"):
        partes.append(f"Segurança: {item['seguranca']}")
    return {"id": item["id"], "titulo": item["categoria"], "secoes": [(item["categoria"], " ".join(partes))],
            "fonte": item.get("fonte", ""), "url": item.get("fonte_url", ""), "validado": bool(item.get("validado"))}


def _docs_faq(texto: str) -> list[dict]:
    """Cada `## Pergunta` do FAQ é um documento; a linha `Fonte: nome | url` vira metadado."""
    docs = []
    for i, bloco in enumerate(b for b in re.split(r"^## ", texto, flags=re.M) if b.strip()):
        titulo, _, corpo = bloco.partition("\n")
        fonte, url = "", ""
        m = re.search(r"^Fonte: (.+?) \| (\S+)", corpo, flags=re.M)
        if m:
            fonte, url = m.group(1).strip(), m.group(2).strip()
            corpo = corpo[: m.start()] + corpo[m.end():]
        docs.append({"id": f"faq_{i}", "titulo": titulo.strip(), "secoes": [(titulo.strip(), corpo.strip())],
                     "fonte": fonte, "url": url, "validado": False})
    return docs


def carregar_documentos(base_dir: Path) -> list[dict]:
    itens = json.loads((base_dir / "quem_resolve.json").read_text(encoding="utf-8"))
    docs = [_doc_categoria(i) for i in itens]
    faq = base_dir / "faq.md"
    if faq.exists():
        docs += _docs_faq(faq.read_text(encoding="utf-8"))
    return docs


def cortar_fixo(texto: str, tamanho: int, overlap: int) -> list[str]:
    """Janela deslizante por caracteres, sem cortar palavras (igual ao notebook)."""
    pedacos, ini = [], 0
    while ini < len(texto):
        fim = min(ini + tamanho, len(texto))
        if fim < len(texto):
            esp = texto.rfind(" ", ini + int(tamanho * 0.6), fim)
            fim = esp if esp != -1 else fim
        pedacos.append(texto[ini:fim].strip())
        if fim >= len(texto):
            break
        ini = max(fim - overlap, ini + 1)
        if overlap:
            esp = texto.find(" ", ini)
            ini = esp + 1 if 0 <= esp < fim else ini
    return [p for p in pedacos if p]


def chunk_estrutural(docs: list[dict], max_chars: int = MAX_CHARS, overlap: int = OVERLAP,
                     min_chars: int = MIN_CHARS) -> list[Trecho]:
    out: list[Trecho] = []
    for d in docs:
        fundidas, pend = [], None
        for s, t in d["secoes"]:
            if not t:
                continue
            if pend:
                s, t, pend = pend[0], pend[1] + "\n" + t, None
            if len(t) < min_chars:
                pend = (s, t)
                continue
            fundidas.append((s, t))
        if pend:
            fundidas.append(pend)
        i = 0
        for s, t in fundidas:
            for p in ([t] if len(t) <= max_chars else cortar_fixo(t, max_chars, overlap)):
                out.append(Trecho(id=f"{d['id']}#{i}", doc_id=d["id"], titulo=d["titulo"], secao=s, texto=p,
                                  texto_indexado=f"Serviço: {d['titulo']} | Seção: {s}\n{p}",
                                  fonte=d["fonte"], url=d["url"], validado=d["validado"]))
                i += 1
    return out

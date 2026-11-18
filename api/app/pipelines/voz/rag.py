"""Base de conhecimento com RAG (recuperação semântica + contexto no prompt).

Chunking: um documento por categoria da base "Quem resolve o quê" e um por
seção do FAQ. Cada categoria é uma unidade de sentido completa (responsável,
canal, segurança e fonte), então quebrar mais perderia o vínculo entre
"quem resolve" e "como acionar".
"""
import json
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np


@dataclass
class Documento:
    id: str
    titulo: str
    texto: str
    fonte: str
    fonte_url: str


def carregar_documentos(base_dir: Path) -> list[Documento]:
    docs: list[Documento] = []
    for item in json.loads((base_dir / "quem_resolve.json").read_text(encoding="utf-8")):
        texto = (
            f"Problema: {item['categoria']}. Exemplos: {', '.join(item['exemplos'])}. "
            f"Quem resolve: {item['responsavel']}. Como acionar: {item['como_acionar']} "
            f"{('Segurança: ' + item['seguranca']) if item['seguranca'] else ''}"
        ).strip()
        docs.append(Documento(item["id"], item["categoria"], texto, item["fonte"], item["fonte_url"]))

    faq = (base_dir / "faq.md").read_text(encoding="utf-8")
    for bloco in re.split(r"^## ", faq, flags=re.M):
        if not bloco.strip():
            continue
        titulo, _, corpo = bloco.partition("\n")
        fonte, url = "", ""
        m = re.search(r"^Fonte: (.+?) \| (\S+)", corpo, flags=re.M)
        if m:
            fonte, url = m.group(1), m.group(2)
            corpo = corpo[: m.start()]
        docs.append(Documento(f"faq_{len(docs)}", titulo.strip(), f"{titulo.strip()}. {corpo.strip()}", fonte, url))
    return docs


class BaseConhecimento:
    def __init__(self, base_dir: Path, modelo: str, top_k: int = 3, limiar: float = 0.35):
        from sentence_transformers import SentenceTransformer

        self.docs = carregar_documentos(base_dir)
        self.top_k = top_k
        self.limiar = limiar
        self.encoder = SentenceTransformer(modelo)
        self.matriz = self.encoder.encode([d.texto for d in self.docs], normalize_embeddings=True)

    def _buscar(self, consulta: str) -> list[tuple[Documento, float]]:
        q = self.encoder.encode([consulta], normalize_embeddings=True)[0]
        scores = self.matriz @ q
        ordem = np.argsort(-scores)[: self.top_k]
        return [(self.docs[i], float(scores[i])) for i in ordem]

    def buscar(self, pergunta: str, pergunta_anterior: str = "") -> list[tuple[Documento, float]]:
        """Busca pela pergunta atual e também pela pergunta atual somada à anterior.

        Isso resolve continuações como "e qual é o telefone deles?", que sozinhas
        não dizem de qual problema o cidadão está falando.
        """
        resultados = self._buscar(pergunta)
        if pergunta_anterior:
            resultados += self._buscar(f"{pergunta_anterior} {pergunta}")
        melhores: dict[str, tuple[Documento, float]] = {}
        for doc, score in resultados:
            if doc.id not in melhores or score > melhores[doc.id][1]:
                melhores[doc.id] = (doc, score)
        ordenados = sorted(melhores.values(), key=lambda x: -x[1])
        return [(d, s) for d, s in ordenados if s >= self.limiar][: self.top_k]

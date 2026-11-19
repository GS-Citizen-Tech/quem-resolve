"""Retriever (notebook, Seção 3): BM25 + denso com Reciprocal Rank Fusion e reranker cross-encoder.

- BM25: forte em termos exatos do cidadão ("bueiro", "Enel", "156").
- Denso `intfloat/multilingual-e5-small` (prefixos query:/passage:): pega paráfrases ("tá tudo escuro na rua" ≈
  "lâmpada do poste apagada"). Leve (118M), roda em CPU.
- Híbrido RRF k=60: junta os dois rankings sem calibrar escalas.
- Reranker `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`: relê pergunta + trecho juntos nos 20 melhores candidatos.
- `max_sim` (cosseno denso do trecho mais parecido) alimenta o gate de abstenção do pipeline.
Trechos em quarentena nunca entram no índice.
"""
import re

import numpy as np

from app.pipelines.texto import normalizar

STOP = set(normalizar(w) for w in """a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se
ao aos à às ou como mais mas foi ser são seu sua seus suas eu você voce meu minha me te lhe isso isto este esta esse essa
qual quais quando onde quem há ha já ja não nao sim tem ter pelo pela pelos pelas""".split())


def tokenizar(t: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", normalizar(t)) if w not in STOP and len(w) > 1]


class BM25Ret:
    def __init__(self, trechos):
        from rank_bm25 import BM25Okapi

        self.trechos = trechos
        self.bm25 = BM25Okapi([tokenizar(t.texto_indexado) for t in trechos])

    def buscar(self, q: str, k: int = 5):
        s = self.bm25.get_scores(tokenizar(q))
        return [(self.trechos[i], float(s[i])) for i in np.argsort(-s)[:k]]


class DensoRet:
    def __init__(self, trechos, modelo):
        self.trechos, self.modelo = trechos, modelo
        self.M = modelo.encode(["passage: " + t.texto_indexado for t in trechos],
                               normalize_embeddings=True, batch_size=32, show_progress_bar=False)

    def _sims(self, q: str):
        return self.M @ self.modelo.encode(["query: " + q], normalize_embeddings=True, show_progress_bar=False)[0]

    def buscar(self, q: str, k: int = 5):
        s = self._sims(q)
        return [(self.trechos[i], float(s[i])) for i in np.argsort(-s)[:k]]

    def max_sim(self, q: str) -> float:
        return float(self._sims(q).max())


class HibridoRet:
    def __init__(self, bm25: BM25Ret, denso: DensoRet, rrf_k: int = 60):
        self.bm25, self.denso, self.rrf_k = bm25, denso, rrf_k

    def buscar(self, q: str, k: int = 5, n: int = 30):
        pont: dict[str, list] = {}
        for ret in (self.bm25, self.denso):
            for pos, (t, _) in enumerate(ret.buscar(q, n)):
                pont.setdefault(t.id, [t, 0.0])[1] += 1.0 / (self.rrf_k + pos + 1)
        return [(t, s) for t, s in sorted(pont.values(), key=lambda x: -x[1])[:k]]


class RerankRet:
    def __init__(self, base: HibridoRet, reranker, n_cand: int = 20):
        self.base, self.reranker, self.n_cand = base, reranker, n_cand

    def buscar(self, q: str, k: int = 5):
        cands = self.base.buscar(q, self.n_cand)
        if not cands:
            return []
        s = self.reranker.predict([(q, t.texto_indexado) for t, _ in cands], show_progress_bar=False)
        return [(cands[i][0], float(s[i])) for i in np.argsort(-s)[:k]]


class Indice:
    """Índice pronto para o pipeline: `buscar` (híbrido + rerank) e `max_sim` (gate)."""

    def __init__(self, trechos, modelo_emb: str, modelo_rerank: str | None, rrf_k: int = 60, n_cand: int = 20):
        from sentence_transformers import SentenceTransformer

        self.trechos = [t for t in trechos if not t.quarentena]
        self.denso = DensoRet(self.trechos, SentenceTransformer(modelo_emb))
        hib = HibridoRet(BM25Ret(self.trechos), self.denso, rrf_k)
        if modelo_rerank:
            from sentence_transformers import CrossEncoder

            self.ret = RerankRet(hib, CrossEncoder(modelo_rerank, max_length=512), n_cand)
        else:
            self.ret = hib

    def buscar(self, q: str, k: int):
        return [t for t, _ in self.ret.buscar(q, k)]

    def max_sim(self, q: str) -> float:
        return self.denso.max_sim(q)

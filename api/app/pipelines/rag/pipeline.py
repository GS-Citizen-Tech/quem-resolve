"""Pipeline completo do RAG (notebook, Seção 6, função `responder`).

máscara de PII → guarda de entrada → recuperação (histórico + pergunta) → gate de similaridade (abstém sem chamar o
LLM) → LLM com contexto em tags → pós-validação → citações tiradas do texto (o front mostra as fontes à parte).
O índice e o gerador são injetáveis: os testes rodam sem baixar modelos nem chamar o LLM.
"""
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field

from app.pipelines.texto import normalizar

from . import seguranca as seg
from .gerador import SYSTEM_PROMPT, montar_prompt_usuario

log = logging.getLogger(__name__)

MSG_RECUSA = ("Não posso atender a esse pedido. Posso ajudar a descobrir quem resolve problemas de rua e serviços da "
              "cidade, como buraco, poste apagado, lixo, vazamento e árvore.")
MSG_GATE = ("Não encontrei isso na minha base. Eu ajudo a descobrir quem resolve problemas de rua e serviços da cidade, "
            "como buraco, poste apagado, lixo e vazamento. Para outros assuntos, ligue 156 ou use o SP156.")
MSG_FALHA_LLM = "Estou com um problema para responder agora. Enquanto isso, você pode ligar para o SP156 no 156."


@dataclass
class Resultado:
    status: str
    resposta: str
    trechos_citados: list = field(default_factory=list)
    contexto: list[str] = field(default_factory=list)
    alertas: list[str] = field(default_factory=list)
    sim_max: float | None = None
    modelo: str = ""
    latencia_s: float = 0.0


class AssistenteRAG:
    def __init__(self, indice, gerador, top_k: int = 4, limiar: float = 0.82, turnos_historico: int = 4,
                 usar_gate: bool = True, dominios=seg.DOMINIOS_PADRAO, cache: int = 200):
        self.indice, self.gerador = indice, gerador
        self.top_k, self.limiar, self.turnos, self.usar_gate, self.dominios = top_k, limiar, turnos_historico, usar_gate, dominios
        self._cache: OrderedDict[tuple, Resultado] = OrderedDict()
        self._tam_cache = cache
        self._trava = threading.Lock()

    def responder(self, pergunta: str, historico: list[tuple[str, str]] | None = None) -> Resultado:
        """`historico`: pares (papel, texto), papel = "cidadao" | "assistente", do mais antigo ao mais recente."""
        t0 = time.perf_counter()
        historico = [(p, seg.mascarar_pii(seg.tirar_citacoes(x))) for p, x in (historico or [])][-2 * self.turnos:]
        p = seg.mascarar_pii(pergunta)
        alertas = ["pii_mascarada_na_entrada"] if p != pergunta else []

        suspeita, achados = seg.guarda_entrada(pergunta)
        if suspeita:
            return Resultado("recusada", MSG_RECUSA, alertas=alertas + [f"guarda_entrada:{achados or 'dados_terceiros'}"],
                             modelo="guarda-entrada", latencia_s=_desde(t0))

        chave = (normalizar(" ".join(p.split())), tuple(historico))
        with self._trava:
            if chave in self._cache:
                return self._cache[chave]

        anteriores = [x for papel, x in historico if papel == "cidadao"][-2:]
        consulta = " ".join(anteriores + [p])
        sim = self.indice.max_sim(consulta)
        trechos = self.indice.buscar(consulta, self.top_k)
        if self.usar_gate and sim < self.limiar:
            return Resultado("sem_evidencia", MSG_GATE, contexto=[t.id for t in trechos], alertas=alertas + ["gate_similaridade"],
                             sim_max=round(sim, 3), modelo="gate", latencia_s=_desde(t0))

        try:
            saida = self.gerador.gerar(SYSTEM_PROMPT, montar_prompt_usuario(p, trechos, historico))
        except Exception as e:  # noqa: BLE001 - sem LLM o cidadão recebe o 156, nunca um erro
            log.error("LLM do RAG falhou: %s", e)
            return Resultado("sem_evidencia", MSG_FALHA_LLM, contexto=[t.id for t in trechos], alertas=alertas + ["falha_llm"],
                             sim_max=round(sim, 3), modelo=getattr(self.gerador, "nome", "llm"), latencia_s=_desde(t0))
        if saida.get("status") not in seg.STATUS_VALIDOS:
            saida["status"] = "sem_evidencia"
        saida, al = seg.pos_validar(saida, trechos, p, self.dominios)
        por_id = {t.id: t for t in trechos}
        res = Resultado(saida["status"], seg.tirar_citacoes(saida["resposta"]),
                        trechos_citados=[por_id[c] for c in saida["citacoes"]], contexto=[t.id for t in trechos],
                        alertas=alertas + al, sim_max=round(sim, 3), modelo=getattr(self.gerador, "nome", "llm"),
                        latencia_s=_desde(t0))
        if al:
            log.info("RAG pós-validação: %s", al)
        with self._trava:
            self._cache[chave] = res
            while len(self._cache) > self._tam_cache:
                self._cache.popitem(last=False)
        return res


def _desde(t0: float) -> float:
    return round(time.perf_counter() - t0, 3)

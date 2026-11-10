from collections import Counter

from app.schemas.metricas import Contagem, Metricas
from app.schemas.ocorrencia import Ocorrencia

PREFEITURA = {"subprefeitura", "prefeitura", "cet", "proprietario", "concessionaria_coleta"}


def _contar(valores) -> list[Contagem]:
    return [Contagem(chave=k, total=v) for k, v in Counter(valores).most_common()]


def calcular(oc: list[Ocorrencia]) -> Metricas:
    n = len(oc) or 1
    return Metricas(
        total=len(oc),
        por_categoria=_contar(o.categoria_final for o in oc),
        por_responsavel=_contar(o.responsavel_id for o in oc),
        por_origem=_contar(o.origem for o in oc),
        pct_fora_prefeitura=round(100 * sum(o.responsavel_id not in PREFEITURA for o in oc) / n, 1),
        taxa_correcao_cidadao=round(100 * sum(o.corrigida_pelo_cidadao for o in oc) / n, 1),
    )

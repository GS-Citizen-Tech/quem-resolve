"""Gerador de ocorrências simuladas (RF34) para a demo e para o console ter dados desde o dia 1."""
import random
from datetime import datetime, timedelta, timezone

from app.pipelines import ocorrencias
from app.providers import base_conhecimento as base
from app.schemas.base import Localizacao
from app.schemas.ocorrencia import OcorrenciaCriar

BAIRROS = {
    "Itaquera": (-23.5400, -46.4560), "São Mateus": (-23.6100, -46.4780), "Pinheiros": (-23.5670, -46.6930),
    "Sé": (-23.5500, -46.6340), "Capão Redondo": (-23.6700, -46.7790), "Santana": (-23.5020, -46.6250),
    "Butantã": (-23.5710, -46.7080), "Penha": (-23.5250, -46.5430),
}
PESOS = {"buraco": 9, "lixo_acumulado": 8, "descarte_irregular": 7, "iluminacao": 6, "calcada": 5, "boca_de_lobo": 5,
         "arvore": 4, "fio_telecom": 4, "coleta_lixo": 4, "vazamento_agua": 3, "semaforo": 3, "esgoto": 2,
         "poste": 2, "lixeira": 2, "varricao": 2, "veiculo_abandonado": 2, "alagamento": 2, "fio_energia": 1}


def gerar(n: int, seed: int = 42) -> int:
    rnd = random.Random(seed)
    cats, pesos = list(PESOS), list(PESOS.values())
    agora = datetime.now(timezone.utc)
    for _ in range(n):
        bairro, (lat, lon) = rnd.choice(list(BAIRROS.items()))
        cid = rnd.choices(cats, pesos)[0]
        origem = "frota" if cid in ("buraco", "lixo_acumulado", "boca_de_lobo", "descarte_irregular") and rnd.random() < 0.4 else "cidadao"
        sugerida = cid if rnd.random() > 0.12 else rnd.choice(cats)
        ocorrencias.registrar(
            OcorrenciaCriar(
                descricao=f"{base.categoria(cid).nome} em {bairro} (simulado)",
                localizacao=Localizacao(lat=lat + rnd.uniform(-0.02, 0.02), lon=lon + rnd.uniform(-0.02, 0.02)),
                categoria_sugerida=sugerida,
                confianca=round(rnd.uniform(0.5, 0.97), 2),
                categoria_final=cid,
            ),
            origem=origem,
            criada_em=agora - timedelta(hours=rnd.uniform(0, 24 * 30)),
        )
    return n

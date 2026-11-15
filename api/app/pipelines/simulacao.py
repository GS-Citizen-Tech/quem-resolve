"""Gerador de ocorrências simuladas (RF34) para a demo e para o console ter dados desde o dia 1."""
import random
from datetime import datetime, timedelta, timezone

from app.pipelines import ocorrencias
from app.providers import base_conhecimento as base, repositorio
from app.schemas.base import Localizacao
from app.schemas.ocorrencia import OcorrenciaCriar

# Lugares de exemplo espalhados pela cidade (reportes soltos).
BAIRROS = {
    "Itaquera": (-23.5400, -46.4560), "São Mateus": (-23.6100, -46.4780), "Pinheiros": (-23.5670, -46.6930),
    "Sé": (-23.5500, -46.6340), "Capão Redondo": (-23.6700, -46.7790), "Santana": (-23.5020, -46.6250),
    "Butantã": (-23.5710, -46.7080), "Penha": (-23.5250, -46.5430), "Grajaú": (-23.7560, -46.6900),
    "Brasilândia": (-23.4700, -46.6870), "Cidade Tiradentes": (-23.5920, -46.4040), "Mooca": (-23.5590, -46.5980),
    "Jabaquara": (-23.6450, -46.6420), "Vila Mariana": (-23.5890, -46.6340), "Lapa": (-23.5230, -46.7040),
    "Campo Limpo": (-23.6450, -46.7600), "Tucuruvi": (-23.4800, -46.6050), "Ipiranga": (-23.5900, -46.6060),
    "Vila Prudente": (-23.5850, -46.5800), "Jaraguá": (-23.4500, -46.7400),
}
# Pontos quentes (v1.3): o mesmo problema, no mesmo lugar, reportado por várias pessoas (e às vezes pelo ônibus).
# No mapa do console viram bolas grandes; a prioridade sobe com 3 reportes ou mais.
PONTOS_QUENTES = [
    ("Itaquera", (-23.5455, -46.4570), "buraco", 8),  # fora da linha 3789-10 da frota
    ("Grajaú", (-23.7560, -46.6900), "lixo_acumulado", 6),
    ("Sé", (-23.5503, -46.6339), "descarte_irregular", 6),
    ("Santana", (-23.5020, -46.6250), "boca_de_lobo", 7),
    ("Capão Redondo", (-23.6705, -46.7790), "lixo_acumulado", 5),
    ("São Mateus", (-23.6100, -46.4780), "buraco", 5),
    ("Cidade Tiradentes", (-23.5920, -46.4040), "coleta_lixo", 5),
    ("Pinheiros", (-23.5650, -46.6840), "iluminacao", 4),
    ("Brasilândia", (-23.4700, -46.6870), "buraco", 4),
    ("Jabaquara", (-23.6450, -46.6420), "vazamento_agua", 4),
    ("Lapa", (-23.5230, -46.7040), "descarte_irregular", 4),
    ("Penha", (-23.5250, -46.5430), "arvore", 3),
    ("Mooca", (-23.5590, -46.5980), "fio_telecom", 3),
    ("Butantã", (-23.5710, -46.7080), "calcada", 3),
    ("Vila Mariana", (-23.5890, -46.6340), "semaforo", 2),
]
PESOS = {"buraco": 9, "lixo_acumulado": 8, "descarte_irregular": 7, "iluminacao": 6, "calcada": 5, "boca_de_lobo": 5,
         "arvore": 4, "fio_telecom": 4, "coleta_lixo": 4, "vazamento_agua": 3, "semaforo": 3, "esgoto": 2,
         "poste": 2, "lixeira": 2, "varricao": 2, "veiculo_abandonado": 2, "alagamento": 2, "fio_energia": 1}
FROTA_ACHA = ("buraco", "lixo_acumulado", "boca_de_lobo", "descarte_irregular")


def _registrar(rnd: random.Random, bairro: str, lat: float, lon: float, cid: str, agora: datetime) -> None:
    origem = "frota" if cid in FROTA_ACHA and rnd.random() < 0.35 else "cidadao"
    sugerida = cid if rnd.random() > 0.12 else rnd.choice(list(PESOS))
    ocorrencias.registrar(
        OcorrenciaCriar(
            descricao=f"{base.categoria(cid).nome} em {bairro} (simulado)",
            localizacao=Localizacao(lat=lat, lon=lon),
            categoria_sugerida=sugerida,
            confianca=round(rnd.uniform(0.5, 0.97), 2),
            categoria_final=cid,
        ),
        origem=origem,
        criada_em=agora - timedelta(hours=rnd.uniform(0, 24 * 30)),
    )


def gerar(n: int, seed: int = 42) -> int:
    """n ocorrências: primeiro os pontos quentes (até ~70), o resto solto pela cidade."""
    rnd = random.Random(seed)
    cats, pesos = list(PESOS), list(PESOS.values())
    agora = datetime.now(timezone.utc)
    feitas = 0
    for bairro, (lat, lon), cid, vezes in PONTOS_QUENTES:
        for _ in range(vezes):
            if feitas >= n:
                return feitas
            # até ~20 m do ponto: cai no mesmo grupo de duplicatas (raio de 50 m)
            _registrar(rnd, bairro, lat + rnd.uniform(-0.00018, 0.00018), lon + rnd.uniform(-0.00018, 0.00018), cid, agora)
            feitas += 1
    while feitas < n:
        bairro, (lat, lon) = rnd.choice(list(BAIRROS.items()))
        _registrar(rnd, bairro, lat + rnd.uniform(-0.015, 0.015), lon + rnd.uniform(-0.015, 0.015), rnd.choices(cats, pesos)[0], agora)
        feitas += 1
    return feitas


VERSAO = "1.3.2"  # sobe quando os dados de exemplo mudam: a API troca os antigos sozinha na próxima subida


def atualizar_se_preciso(n: int) -> str | None:
    """Na subida da API. Banco sem a simulação desta versão → apaga só o que é simulado e cria de novo.
    Reportes reais ficam. Devolve o que fez (para o log) ou None se já estava em dia."""
    if repositorio.meta("simulacao") == VERSAO:
        return None
    apagadas, _ = repositorio.apagar_simuladas()
    reais_o = [x.id for x in repositorio.ocorrencias()]
    reais_p = list(repositorio.passagens())
    gerar(n)
    gerar_frota()
    repositorio.marcar_simuladas(reais_o, reais_p)
    repositorio.gravar_meta("simulacao", VERSAO)
    return f"dados de exemplo v{VERSAO}: {apagadas} antigos trocados por {n} novos (com pontos quentes); {len(reais_o)} reais mantidos"


def _linha(a: tuple[float, float], b: tuple[float, float], n: int = 25) -> list[tuple[float, float]]:
    return [(round(a[0] + (b[0] - a[0]) * i / (n - 1), 6), round(a[1] + (b[1] - a[1]) * i / (n - 1), 6)) for i in range(n)]


def gerar_frota() -> int:
    """3 passagens de ônibus de exemplo (v0.8), para a tela da frota abrir com dados e mostrar as regras:
    - a 1ª passagem da linha 3789-10 encontra 3 danos (um deles já reportado por um cidadão → vira "ambos");
    - a 2ª passagem, hoje, só vê 2 deles → o 3º vira "possivelmente resolvida";
    - a linha 8000-10 (Penha) mostra outro trajeto."""
    from app.pipelines import frota  # import local: frota importa ocorrencias, que já está carregado
    from app.schemas.frota import DeteccaoFrota, PassagemFrota
    from app.schemas.visao import Deteccao

    agora = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    itaquera = _linha((-23.5402, -46.4705), (-23.5398, -46.4405))
    danos = [(itaquera[5], "D40", 0.71), (itaquera[12], "D00", 0.55), (itaquera[19], "D20", 0.62)]

    # Dona Cida reportou o primeiro buraco antes de o ônibus passar.
    ocorrencias.registrar(OcorrenciaCriar(
        descricao="Buraco grande na rua, perto do ponto de ônibus (simulado)",
        localizacao=Localizacao(lat=danos[0][0][0] + 0.0001, lon=danos[0][0][1]),
        categoria_sugerida="buraco", confianca=0.9, categoria_final="buraco"),
        origem="cidadao", criada_em=agora - timedelta(days=3))

    def passagem(linha, trajeto, inicio, achados, fps):
        return PassagemFrota(
            linha_onibus=linha, inicio=inicio, fim=inicio + timedelta(minutes=38), trajeto=trajeto, fps_processamento=fps,
            deteccoes=[DeteccaoFrota(detectada_em=inicio + timedelta(minutes=4 + 3 * i), lat=pt[0], lon=pt[1],
                                     deteccao=Deteccao(classe=cl, categoria_id="buraco", confianca=cf,
                                                       bbox=(0.32, 0.58, 0.61, 0.86)))
                       for i, (pt, cl, cf) in enumerate(achados)])

    frota.ingerir(passagem("3789-10", itaquera, agora - timedelta(days=2, hours=5), danos, 7.4))
    frota.ingerir(passagem("3789-10", itaquera, agora - timedelta(hours=3), danos[:2], 6.9))
    penha = _linha((-23.5262, -46.5520), (-23.5228, -46.5290))
    frota.ingerir(passagem("8000-10", penha, agora - timedelta(days=1, hours=2), [(penha[8], "D40", 0.66), (penha[17], "D10", 0.48)], 8.1))
    return 3

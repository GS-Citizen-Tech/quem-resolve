"""Ingestão das detecções da frota (VC + Cluster). O processamento do vídeo roda fora da API
(Colab / workers); aqui chegam só detecções já borradas e o trajeto."""
import math
import uuid
from datetime import datetime

from app.pipelines import ocorrencias
from app.providers import base_conhecimento as base
from app.providers import repositorio
from app.schemas.base import Localizacao
from app.schemas.frota import PassagemFrota, ResultadoIngestao
from app.schemas.ocorrencia import OcorrenciaCriar


RAIO_REVISITA_M = 25  # o ônibus passou a até 25 m do problema


def _dist_ponto_segmento_m(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distância (m) do ponto ao segmento a-b, numa projeção plana local (suficiente para dezenas de metros)."""
    lat0 = math.radians(p[0])
    xy = lambda q: ((q[1] - p[1]) * 111_320 * math.cos(lat0), (q[0] - p[0]) * 110_540)  # noqa: E731
    (ax, ay), (bx, by) = xy(a), xy(b)
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    return math.hypot(ax + t * dx, ay + t * dy)


def _passou_perto(lat: float, lon: float, trajeto: list[tuple[float, float]]) -> bool:
    if len(trajeto) == 1:
        return ocorrencias.distancia_m(lat, lon, *trajeto[0]) <= RAIO_REVISITA_M
    return any(_dist_ponto_segmento_m((lat, lon), a, b) <= RAIO_REVISITA_M for a, b in zip(trajeto, trajeto[1:]))


def marcar_possivelmente_resolvidas(p: PassagemFrota, antes_de: datetime) -> int:
    """Regra v0.8: o ônibus passou a até 25 m de um problema aberto que a câmera sabe ver (ex.: buraco)
    e NÃO o detectou de novo → "possivelmente resolvida". O gestor confirma depois."""
    vistos = [(d.deteccao.categoria_id, d.lat, d.lon) for d in p.deteccoes if d.deteccao.categoria_id]
    n = 0
    for o in repositorio.ocorrencias():
        cat = base.categoria(o.categoria_final)
        if (o.status in ("resolvida", "possivelmente_resolvida") or o.origem == "cidadao" or not cat or not cat.classes_visao
                or o.criada_em >= antes_de or not _passou_perto(o.lat, o.lon, p.trajeto)):
            continue
        if any(c == o.categoria_final and ocorrencias.distancia_m(o.lat, o.lon, la, lo) <= RAIO_REVISITA_M for c, la, lo in vistos):
            continue
        o.status = "possivelmente_resolvida"
        n += 1
    return n


def ingerir(p: PassagemFrota) -> ResultadoIngestao:
    pid = str(uuid.uuid4())
    novas = associadas = 0
    resolvidas = marcar_possivelmente_resolvidas(p, antes_de=p.inicio)
    for d in p.deteccoes:
        cid = d.deteccao.categoria_id
        if not cid:
            continue
        ja_existia = ocorrencias.duplicata_de(cid, d.lat, d.lon) is not None
        ocorrencias.registrar(
            OcorrenciaCriar(
                descricao=f"Detectado pela frota (linha {p.linha_onibus}): {d.deteccao.classe}",
                localizacao=Localizacao(lat=d.lat, lon=d.lon),
                categoria_sugerida=cid,
                confianca=d.deteccao.confianca,
                categoria_final=cid,
                foto_url=d.recorte_url,
            ),
            origem="frota",
            criada_em=d.detectada_em,
        )
        associadas += ja_existia
        novas += not ja_existia
    repositorio.salvar_passagem(pid, {
        "linha_onibus": p.linha_onibus, "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat(),
        "trajeto": p.trajeto, "deteccoes": len(p.deteccoes), "fps": p.fps_processamento,
        "possivelmente_resolvidas": resolvidas,
    })
    return ResultadoIngestao(passagem_id=pid, novas_ocorrencias=novas, associadas_a_existentes=associadas,
                             possivelmente_resolvidas=resolvidas)

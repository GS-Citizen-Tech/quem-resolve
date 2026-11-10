"""Ingestão das detecções da frota (VC + Cluster). O processamento do vídeo roda fora da API
(Colab / workers); aqui chegam só detecções já borradas e o trajeto."""
import uuid

from app.pipelines import ocorrencias
from app.providers import repositorio
from app.schemas.base import Localizacao
from app.schemas.frota import PassagemFrota, ResultadoIngestao
from app.schemas.ocorrencia import OcorrenciaCriar


def ingerir(p: PassagemFrota) -> ResultadoIngestao:
    pid = str(uuid.uuid4())
    novas = associadas = 0
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
    })
    return ResultadoIngestao(passagem_id=pid, novas_ocorrencias=novas, associadas_a_existentes=associadas)

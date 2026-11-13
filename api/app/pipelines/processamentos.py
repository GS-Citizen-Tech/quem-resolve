"""Processamento da frota DENTRO da solução (v1.0): o gestor envia, pela tela "Frota" do console, um vídeo curto ou
uma sequência de fotos. A API processa em segundo plano (uma fila, um por vez, para não travar as outras rotas),
com o mesmo núcleo do script do ônibus (app/pipelines/frota_video.py), e entrega:
- progresso quadro a quadro (GET /frota/processamentos/{id});
- o vídeo anotado, já borrado (GET /frota/processamentos/{id}/video);
- as ocorrências no mapa, pela mesma ingestão de POST /frota/passagens.

Privacidade: o arquivo enviado (vídeo ou fotos brutas) é apagado assim que o processamento termina, com sucesso ou não.
Fica só o vídeo anotado (borrado), e só dos últimos MANTER processamentos. Tudo em pasta temporária: some ao reiniciar.
"""
from __future__ import annotations

import logging
import shutil
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from app import config
from app.pipelines import frota
from app.pipelines.frota_video import EXT_FOTO, ErroEntrada, Opcoes, processar
from app.schemas.frota import PassagemFrota, Processamento

log = logging.getLogger(__name__)

EXT_VIDEO = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"}
MANTER = 5  # processamentos guardados (com vídeo anotado); os mais antigos somem

_fila = ThreadPoolExecutor(max_workers=1, thread_name_prefix="frota")
_trava = threading.Lock()
_jobs: dict[str, Processamento] = {}
_pastas: dict[str, Path] = {}
_videos: dict[str, Path] = {}


def pasta_base() -> Path:
    p = Path(config.FROTA_PASTA) if config.FROTA_PASTA else Path(tempfile.gettempdir()) / "quem-resolve-frota"
    p.mkdir(parents=True, exist_ok=True)
    return p


def tipo_do_arquivo(nome: str) -> str | None:
    ext = Path(nome).suffix.lower()
    return "video" if ext in EXT_VIDEO else "fotos" if ext in EXT_FOTO else None


def criar(enviado_por: str, linha: str, tipo: str, nomes: list[str]) -> tuple[Processamento, Path]:
    """Registra o processamento e devolve a pasta onde a rota grava os arquivos recebidos (em entrada/)."""
    pid = uuid.uuid4().hex[:12]
    pasta = pasta_base() / pid
    (pasta / "entrada").mkdir(parents=True)
    job = Processamento(id=pid, status="na_fila", criado_em=datetime.now(timezone.utc), enviado_por=enviado_por,
                        linha_onibus=linha, tipo=tipo, arquivos=len(nomes), nome=nomes[0])
    with _trava:
        _jobs[pid], _pastas[pid] = job, pasta
    return job, pasta


def iniciar(pid: str, gpx: Path | None = None):
    _fila.submit(_rodar, pid, gpx)


def _atualizar(pid: str, **campos):
    with _trava:
        _jobs[pid] = _jobs[pid].model_copy(update=campos)


def _rodar(pid: str, gpx: Path | None):
    from app.providers.visao import _yolo

    job, pasta = _jobs[pid], _pastas[pid]
    entrada = pasta / "entrada"
    if job.tipo == "video":
        entrada = next(entrada.iterdir())
    _atualizar(pid, status="processando")
    op = Opcoes(linha=job.linha_onibus, gpx=gpx, max_segundos=config.FROTA_MAX_SEGUNDOS, formato_video="webm",
                fps_seq=config.FROTA_FOTOS_POR_S)

    def progresso(feitos: int, total: int):
        _atualizar(pid, quadros_processados=feitos, quadros_total=total, progresso=round(min(1.0, feitos / total), 3))

    try:
        r = processar(entrada, pasta / "saida", op, _yolo(), progresso)
        aviso = None
        if job.tipo == "video" and r.metricas.get("duracao_s", 0) > config.FROTA_MAX_SEGUNDOS:
            aviso = f"Vídeo com {r.metricas['duracao_s']:.0f} s: processei só os primeiros {config.FROTA_MAX_SEGUNDOS:.0f} s."
        ingestao = frota.ingerir(PassagemFrota.model_validate(r.passagem))
        m = r.metricas
        resumo = {k: m[k] for k in ("tipo", "duracao_s", "resolucao_processada", "modelo", "limiar", "fps_processamento",
                                    "tempo_total_s", "latencia_quadro_ms", "latencia_deteccao_ms", "latencia_borrar_ms",
                                    "tempo_real", "danos_unicos", "regioes_borradas", "gps", "intervalo_quadros_por_s",
                                    "equipamento") if k in m}
        with _trava:
            _videos[pid] = r.video
        _atualizar(pid, status="concluido", progresso=1.0, resultado=ingestao, metricas=resumo, danos=m["danos"],
                   mensagem=aviso, video_disponivel=True,
                   video_tipo="video/webm" if r.video.suffix == ".webm" else "video/mp4")
    except (ErroEntrada, ValueError) as e:
        _atualizar(pid, status="erro", mensagem=str(e))
    except Exception:  # noqa: BLE001 - a fila não pode morrer por causa de um arquivo
        log.exception("Falha no processamento da frota %s", pid)
        _atualizar(pid, status="erro", mensagem="Falha inesperada ao processar. Tente outro arquivo.")
    finally:
        shutil.rmtree(pasta / "entrada", ignore_errors=True)  # o bruto nunca fica guardado
        if gpx:
            gpx.unlink(missing_ok=True)
        _limpar_antigos()


def _limpar_antigos():
    with _trava:
        prontos = sorted((j for j in _jobs.values() if j.status in ("concluido", "erro")), key=lambda j: j.criado_em)
        for j in prontos[:-MANTER] if len(prontos) > MANTER else []:
            shutil.rmtree(_pastas.pop(j.id, Path("/nao-existe")), ignore_errors=True)
            _videos.pop(j.id, None)
            _jobs.pop(j.id, None)


def descartar(pid: str):
    """A rota desiste (arquivo inválido antes de entrar na fila)."""
    with _trava:
        _jobs.pop(pid, None)
        shutil.rmtree(_pastas.pop(pid, Path("/nao-existe")), ignore_errors=True)


def obter(pid: str) -> Processamento | None:
    return _jobs.get(pid)


def listar() -> list[Processamento]:
    return sorted(_jobs.values(), key=lambda j: j.criado_em, reverse=True)


def video(pid: str) -> Path | None:
    p = _videos.get(pid)
    return p if p and p.exists() else None


def ocupado() -> int:
    return sum(j.status in ("na_fila", "processando") for j in _jobs.values())

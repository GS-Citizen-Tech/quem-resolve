"""Núcleo do processamento da frota (VC): vídeo da câmera do ônibus ou sequência de fotos → danos únicos com GPS.

Usado por dois caminhos, com o MESMO código:
- a tela "Frota" do console (POST /frota/processamentos), que roda isto em segundo plano dentro da API;
- o script frota/processar_video.py, a versão "dentro do ônibus", que processa no próprio veículo e só envia o resultado.

Passos (PRD 4.1, RF50–RF56): pega quadros em intervalo fixo, detecta com o YOLO da API no limiar da frota, borra rostos,
pessoas e placas antes de gravar qualquer imagem, junta o mesmo dano em quadros seguidos (rastreio por IoU), associa cada
dano a um ponto do GPS (GPX ou trajeto simulado) e grava o vídeo anotado. O vídeo bruto nunca é guardado.
"""
from __future__ import annotations

import base64
import json
import math
import platform
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from app.providers.privacidade import Borrador
from app.providers.visao import YoloVisao

NOMES = {"D00": "fissura long.", "D10": "fissura transv.", "D20": "fissura malha", "D40": "buraco"}
CORES = {"D00": (222, 134, 46), "D10": (132, 172, 16), "D20": (18, 156, 243), "D40": (60, 76, 231)}  # BGR
EXT_FOTO = {".jpg", ".jpeg", ".png", ".webp"}
# Trajeto simulado quando não há GPX: Av. Paulista, do Paraíso à Consolação (~2,7 km)
TRAJETO_SIMULADO = [(-23.5710, -46.6448), (-23.5672, -46.6489), (-23.5631, -46.6544), (-23.5587, -46.6597), (-23.5555, -46.6625)]


class ErroEntrada(ValueError):
    """Arquivo que não dá para processar (vídeo corrompido, pasta sem fotos, GPX sem pontos...)."""


# ---------------------------------------------------------------- GPS
def ler_gpx(caminho: Path) -> list[tuple[datetime, float, float]]:
    raiz = ET.parse(caminho).getroot()
    pontos = []
    for el in raiz.iter():
        if el.tag.endswith("trkpt") or el.tag.endswith("rtept"):
            t = next((c.text for c in el if c.tag.endswith("time")), None)
            if t:
                pontos.append((datetime.fromisoformat(t.replace("Z", "+00:00")), float(el.get("lat")), float(el.get("lon"))))
    if len(pontos) < 2:
        raise ValueError(f"O GPX {caminho} precisa de pelo menos 2 pontos com horário.")
    return sorted(pontos)


def dist_m(a, b) -> float:
    r = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * r * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


class Gps:
    """Devolve (lat, lon) para um instante do vídeo, interpolando os pontos do GPX ou o trajeto simulado."""

    def __init__(self, gpx: Path | None, duracao_s: float, inicio: datetime | None, deslocamento_s: float):
        if gpx:
            self.pontos = ler_gpx(gpx)
            self.inicio = (inicio or self.pontos[0][0]) + timedelta(seconds=deslocamento_s)
        else:
            self.inicio = inicio or datetime.now(timezone.utc).replace(microsecond=0)
            passos = len(TRAJETO_SIMULADO) - 1
            self.pontos = [(self.inicio + timedelta(seconds=duracao_s * i / passos), lat, lon)
                           for i, (lat, lon) in enumerate(TRAJETO_SIMULADO)]
        self.simulado = gpx is None

    def em(self, t_s: float) -> tuple[float, float]:
        alvo = self.inicio + timedelta(seconds=t_s)
        p = self.pontos
        if alvo <= p[0][0]:
            return p[0][1], p[0][2]
        for (t0, la0, lo0), (t1, la1, lo1) in zip(p, p[1:]):
            if t0 <= alvo <= t1:
                f = (alvo - t0).total_seconds() / max(1e-6, (t1 - t0).total_seconds())
                return la0 + f * (la1 - la0), lo0 + f * (lo1 - lo0)
        return p[-1][1], p[-1][2]

    def trajeto(self, duracao_s: float, passo_s: float = 2.0) -> list[tuple[float, float]]:
        pts = [self.em(t) for t in np.arange(0, duracao_s + passo_s, passo_s)]
        return [(round(a, 6), round(b, 6)) for a, b in pts]


# ---------------------------------------------------------------- rastreio (RF53, versão simples)
@dataclass
class Trilha:
    id: int
    classe: str
    bbox: tuple[float, float, float, float]
    melhor_conf: float
    melhor_t: float
    melhor_quadro: np.ndarray | None = None
    melhor_bbox: tuple[float, float, float, float] = (0, 0, 0, 0)
    ultimo_quadro: int = 0
    vistos: int = 1
    confs: list[float] = field(default_factory=list)


def iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


class Rastreador:
    """Liga a mesma detecção em quadros seguidos (mesma classe e IoU ≥ limite, ou centro próximo descendo na imagem,
    que é como um dano se move quando o ônibus anda). Trilha some depois de `memoria` quadros sem ser vista."""

    def __init__(self, iou_min=0.15, memoria=3, ligar=True):
        self.iou_min, self.memoria, self.ligar = iou_min, memoria, ligar  # ligar=False: fotos independentes
        self.ativas: list[Trilha] = []
        self.fechadas: list[Trilha] = []
        self._prox = 1

    def atualizar(self, n_quadro: int, t: float, deteccoes, quadro) -> list[tuple[Trilha, object]]:
        pares = []
        livres = list(self.ativas) if self.ligar else []
        for d in sorted(deteccoes, key=lambda d: -d.confianca):
            cand = [(iou(d.bbox, tr.bbox), tr) for tr in livres if tr.classe == d.classe]
            cand += [(0.5 * self.iou_min + 1e-3, tr) for tr in livres if tr.classe == d.classe and self._perto(d.bbox, tr.bbox)]
            melhor = max(cand, key=lambda c: c[0], default=(0, None))
            if melhor[1] is not None and melhor[0] >= self.iou_min * 0.5:
                tr = melhor[1]
                livres.remove(tr)
                tr.bbox, tr.ultimo_quadro, tr.vistos = d.bbox, n_quadro, tr.vistos + 1
            else:
                tr = Trilha(self._prox, d.classe, d.bbox, 0.0, t, ultimo_quadro=n_quadro)
                self._prox += 1
                self.ativas.append(tr)
            tr.confs.append(d.confianca)
            if d.confianca > tr.melhor_conf:
                tr.melhor_conf, tr.melhor_t, tr.melhor_bbox = d.confianca, t, d.bbox
                tr.melhor_quadro = quadro
            pares.append((tr, d))
        for tr in list(self.ativas):
            if n_quadro - tr.ultimo_quadro > self.memoria:
                self.ativas.remove(tr)
                self.fechadas.append(tr)
        return pares

    @staticmethod
    def _perto(a, b) -> bool:
        ca, cb = ((a[0] + a[2]) / 2, (a[1] + a[3]) / 2), ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
        return abs(ca[0] - cb[0]) < 0.12 and -0.05 < ca[1] - cb[1] < 0.25

    def todas(self) -> list[Trilha]:
        return sorted(self.fechadas + self.ativas, key=lambda t: t.melhor_t)


# ---------------------------------------------------------------- fonte de quadros
def abrir_fonte(caminho: Path, qps: float, fps_seq: float):
    """Gera (n, t_segundos, quadro BGR). Vídeo: pula quadros para ficar em `qps`. Pasta: uma foto a cada 1/fps_seq s."""
    if caminho.is_dir():
        fotos = sorted(p for p in caminho.iterdir() if p.suffix.lower() in EXT_FOTO)
        if not fotos:
            raise ErroEntrada("Nenhuma foto válida (use JPG, PNG ou WebP).")
        info = {"tipo": "sequencia de imagens", "quadros_total": len(fotos), "fps_origem": fps_seq,
                "duracao_s": len(fotos) / fps_seq, "quadros_a_analisar": len(fotos)}

        def gerador():
            for i, p in enumerate(fotos):
                img = cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_COLOR)
                if img is not None:
                    yield i, i / fps_seq, img
        return info, gerador()
    cap = cv2.VideoCapture(str(caminho))
    if not cap.isOpened():
        raise ErroEntrada("Não consegui abrir o vídeo. Use MP4, MOV ou WebM.")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    passo = max(1, round(fps / qps))
    info = {"tipo": "video", "quadros_total": total, "fps_origem": round(fps, 2), "duracao_s": total / fps if total else 0,
            "resolucao_origem": f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}",
            "quadros_a_analisar": -(-total // passo) if total else 0}

    def gerador():
        i = 0
        while True:
            ok = cap.grab()
            if not ok:
                break
            if i % passo == 0:
                ok, img = cap.retrieve()
                if ok:
                    yield i, i / fps, img
            i += 1
        cap.release()
    return info, gerador()


# ---------------------------------------------------------------- desenho
def desenhar(img, pares, fps_atual: float, n_trilhas: int, borrados: int, gps_txt: str):
    h, w = img.shape[:2]
    esp = max(2, w // 400)
    for tr, d in pares:
        x1, y1, x2, y2 = (int(d.bbox[0] * w), int(d.bbox[1] * h), int(d.bbox[2] * w), int(d.bbox[3] * h))
        cor = CORES.get(d.classe, (0, 0, 255))
        cv2.rectangle(img, (x1, y1), (x2, y2), cor, esp)
        txt = f"#{tr.id} {NOMES.get(d.classe, d.classe)} {d.confianca:.0%}"
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.5 * w / 640, 1)
        cv2.rectangle(img, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), cor, -1)
        cv2.putText(img, txt, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5 * w / 640, (255, 255, 255), 1, cv2.LINE_AA)
    faixa = f"Quem Resolve? frota | {fps_atual:4.1f} FPS | danos unicos: {n_trilhas} | borrados: {borrados} | {gps_txt}"
    cv2.rectangle(img, (0, 0), (w, int(28 * w / 1280) + 10), (20, 20, 20), -1)
    cv2.putText(img, faixa, (8, int(22 * w / 1280) + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6 * w / 1280 + 0.15, (255, 255, 255), 1, cv2.LINE_AA)
    return img


def encaixar(img, tam):
    """Redimensiona mantendo a proporção e completa com preto, para caber no tamanho fixo do vídeo."""
    w, h = tam
    r = min(w / img.shape[1], h / img.shape[0])
    nova = cv2.resize(img, (max(1, round(img.shape[1] * r)), max(1, round(img.shape[0] * r))), interpolation=cv2.INTER_AREA)
    tela = np.zeros((h, w, 3), dtype=img.dtype)
    y0, x0 = (h - nova.shape[0]) // 2, (w - nova.shape[1]) // 2
    tela[y0:y0 + nova.shape[0], x0:x0 + nova.shape[1]] = nova
    return tela


def recorte_data_url(quadro, bbox, borrador: Borrador) -> str:
    """Recorte do dano com margem, já borrado, reduzido e em data URL (o protótipo não tem storage de fotos)."""
    h, w = quadro.shape[:2]
    x1, y1, x2, y2 = bbox
    mx, my = 0.15 * (x2 - x1) + 0.03, 0.15 * (y2 - y1) + 0.03
    xa, ya = int(max(0, x1 - mx) * w), int(max(0, y1 - my) * h)
    xb, yb = int(min(1, x2 + mx) * w), int(min(1, y2 + my) * h)
    rec = quadro[ya:yb, xa:xb].copy()
    borrador.aplicar(rec, borrador.regioes(rec))
    escala = 320 / max(rec.shape[:2])
    if escala < 1:
        rec = cv2.resize(rec, None, fx=escala, fy=escala, interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", rec, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


# ---------------------------------------------------------------- vídeo anotado
def abrir_escritor(destino_sem_ext: Path, formato: str, fps: float, tam: tuple[int, int]):
    """WebM (VP8) toca em qualquer navegador; o MP4 do OpenCV (mp4v) não toca no navegador, mas abre em qualquer player.
    Se o OpenCV da máquina não tiver o codificador pedido, cai para o outro. Devolve (escritor, caminho)."""
    ordem = [("webm", "VP80"), ("mp4", "mp4v")] if formato == "webm" else [("mp4", "mp4v"), ("webm", "VP80")]
    for ext, fourcc in ordem:
        caminho = destino_sem_ext.with_suffix("." + ext)
        esc = cv2.VideoWriter(str(caminho), cv2.VideoWriter_fourcc(*fourcc), fps, tam)
        if esc.isOpened():
            return esc, caminho
        esc.release()
    raise RuntimeError("O OpenCV desta máquina não consegue gravar vídeo (nem WebM nem MP4).")


@dataclass
class Opcoes:
    qps: float = 3.0              # quadros analisados por segundo de vídeo (RF50)
    fps_seq: float = 2.0          # pasta de fotos: quantas fotos equivalem a 1 s
    largura: int = 1280           # reduz quadros maiores para esta largura (0 = não reduz)
    limiar: float | None = None   # None = limiar da frota do modelo (0,35)
    min_vistos: int = 2           # vídeo: dano precisa aparecer em N quadros para contar
    linha: str = "8000-10"
    gpx: Path | None = None
    inicio: datetime | None = None
    deslocamento_gps: float = 0.0
    limite: int = 0               # processa no máximo N quadros (0 = todos)
    max_segundos: float = 0       # vídeo: para depois de N segundos de vídeo (0 = sem limite)
    formato_video: str = "mp4"    # mp4 (script) | webm (console, toca no navegador)


@dataclass
class Resultado:
    passagem: dict
    metricas: dict
    video: Path
    recortes: dict[int, bytes] = field(default_factory=dict)  # id do dano → JPG borrado


def processar(entrada: Path, saida: Path, op: Opcoes, detector: YoloVisao,
              progresso: Callable[[int, int], None] | None = None) -> Resultado:
    """Processa um vídeo ou uma pasta de fotos. `progresso(feitos, total)` é chamado a cada quadro analisado."""
    saida.mkdir(parents=True, exist_ok=True)
    limiar = op.limiar if op.limiar is not None else detector.limiares["frota"]
    borrador = Borrador()
    info, quadros = abrir_fonte(entrada, op.qps, op.fps_seq)
    total = info["quadros_a_analisar"]
    if op.max_segundos and info["tipo"] == "video":
        total = min(total, math.ceil(op.max_segundos * op.qps)) if total else math.ceil(op.max_segundos * op.qps)
    if op.limite:
        total = min(total, op.limite) if total else op.limite
    eh_video = info["tipo"] == "video"
    rast = Rastreador(ligar=eh_video)
    escritor = caminho_video = tam_video = None
    lat_det, lat_borrar, tempos_quadro = [], [], []
    n_proc = n_borrados = 0
    ultimo_t = 0.0
    inicio_total = time.perf_counter()
    gps = None
    resolucao = None

    for n, t, img in quadros:
        if op.max_segundos and eh_video and t > op.max_segundos:
            break
        t0 = time.perf_counter()
        if op.largura and img.shape[1] > op.largura:  # trabalha numa resolução fixa (padrão 1280 px)
            img = cv2.resize(img, (op.largura, round(img.shape[0] * op.largura / img.shape[1])), interpolation=cv2.INTER_AREA)
        if resolucao is None:
            resolucao = f"{img.shape[1]}x{img.shape[0]}"
            duracao = info["duracao_s"] if not (op.max_segundos and eh_video) else min(info["duracao_s"] or op.max_segundos, op.max_segundos)
            gps = Gps(op.gpx, max(duracao, 1.0), op.inicio, op.deslocamento_gps)
        # 1) detecção (mesmo modelo da API) no quadro original, só em memória
        r = detector.detectar_pil(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), limiar=limiar)
        lat_det.append(r.latencia_ms)
        # 2) privacidade: borra rostos, pessoas e placas ANTES de qualquer imagem ser gravada (vídeo anotado e recortes)
        tb = time.perf_counter()
        n_borrados += borrador.aplicar(img, borrador.regioes(img))
        lat_borrar.append((time.perf_counter() - tb) * 1000)
        pares = rast.atualizar(n_proc, t, r.deteccoes, img.copy() if r.deteccoes else None)
        tempos_quadro.append((time.perf_counter() - t0) * 1000)
        n_proc += 1
        ultimo_t = t
        # 3) vídeo anotado
        fps_atual = 1000 / np.mean(tempos_quadro[-15:])
        lat, lon = gps.em(t)
        unicos = sum(tr.vistos >= (op.min_vistos if eh_video else 1) for tr in rast.todas())
        anot = desenhar(img, pares, fps_atual, unicos, n_borrados, f"{lat:.5f}, {lon:.5f}{' (sim.)' if gps.simulado else ''}")
        if escritor is None:
            fps_saida = op.fps_seq if not eh_video else min(op.qps, info["fps_origem"])
            tam_video = (anot.shape[1], anot.shape[0])
            escritor, caminho_video = abrir_escritor(saida / "video_anotado", op.formato_video, fps_saida, tam_video)
        if (anot.shape[1], anot.shape[0]) != tam_video:
            anot = encaixar(anot, tam_video)  # fotos de tamanhos diferentes: o vídeo descartaria o quadro em silêncio
        escritor.write(anot)
        if progresso:
            progresso(n_proc, max(total, n_proc))
        if op.limite and n_proc >= op.limite:
            break
    if escritor:
        escritor.release()
    total_s = time.perf_counter() - inicio_total
    if n_proc == 0:
        raise ErroEntrada("Nenhum quadro processado: o arquivo está vazio ou não é um vídeo/foto válido.")

    # 4) um dano por trilha (vista em pelo menos `min_vistos` quadros), com GPS e recorte borrado
    deteccoes, linhas, recortes = [], [], {}
    (saida / "recortes").mkdir(exist_ok=True)
    for tr in rast.todas():
        if tr.vistos < op.min_vistos and eh_video:
            continue
        lat, lon = gps.em(tr.melhor_t)
        rec = recorte_data_url(tr.melhor_quadro, tr.melhor_bbox, borrador) if tr.melhor_quadro is not None else None
        if rec:
            recortes[tr.id] = base64.b64decode(rec.split(",", 1)[1])
            (saida / "recortes" / f"dano_{tr.id:03d}_{tr.classe}.jpg").write_bytes(recortes[tr.id])
        det = {"classe": tr.classe, "categoria_id": "buraco", "confianca": round(tr.melhor_conf, 3),
               "bbox": [round(v, 4) for v in tr.melhor_bbox]}
        deteccoes.append({"detectada_em": (gps.inicio + timedelta(seconds=tr.melhor_t)).isoformat(),
                          "lat": round(lat, 6), "lon": round(lon, 6), "deteccao": det, "recorte_url": rec})
        linhas.append({"id": tr.id, "classe": tr.classe, "dano": NOMES.get(tr.classe), "quadros": tr.vistos,
                       "conf_max": round(tr.melhor_conf, 3), "t_s": round(tr.melhor_t, 1), "lat": round(lat, 6), "lon": round(lon, 6)})

    fps_proc = n_proc / total_s
    passagem = {
        "linha_onibus": op.linha,
        "inicio": gps.inicio.isoformat(),
        "fim": (gps.inicio + timedelta(seconds=max(ultimo_t, 1.0))).isoformat(),
        "trajeto": gps.trajeto(max(ultimo_t, 1.0)),
        "deteccoes": deteccoes,
        "fps_processamento": round(fps_proc, 2),
    }
    ritmo = op.qps if eh_video else op.fps_seq
    metricas = {
        "entrada": entrada.name, **info, "quadros_processados": n_proc, "intervalo_quadros_por_s": ritmo,
        "resolucao_processada": resolucao, "entrada_modelo": f"{detector.imgsz}x{detector.imgsz} (letterbox)",
        "modelo": detector.nome, "limiar": limiar,
        "fps_processamento": round(fps_proc, 2),
        "tempo_total_s": round(total_s, 1),
        "latencia_quadro_ms": {"media": round(float(np.mean(tempos_quadro)), 1), "p95": round(float(np.percentile(tempos_quadro, 95)), 1)},
        "latencia_deteccao_ms": {"media": round(float(np.mean(lat_det)), 1), "p95": round(float(np.percentile(lat_det, 95)), 1)},
        "latencia_borrar_ms": {"media": round(float(np.mean(lat_borrar)), 1)},
        "tempo_real": "sim" if fps_proc >= ritmo else "não",
        "danos_unicos": len(deteccoes), "regioes_borradas": n_borrados, "gps": "simulado (Av. Paulista)" if gps.simulado else "GPX",
        "equipamento": f"{platform.processor() or platform.machine()} · {platform.system()} · CPU",
        "video_anotado": caminho_video.name,
        "danos": linhas,
    }
    (saida / "passagem.json").write_text(json.dumps(passagem, ensure_ascii=False, indent=1), encoding="utf-8")
    (saida / "metricas.json").write_text(json.dumps(metricas, ensure_ascii=False, indent=1), encoding="utf-8")
    return Resultado(passagem=passagem, metricas=metricas, video=caminho_video, recortes=recortes)

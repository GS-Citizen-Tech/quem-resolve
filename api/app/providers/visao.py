"""Acesso ao detector de visão (disciplina 09).

- `MockVisao`: resultado fixo por foto, para desenvolver o front sem o modelo.
- `YoloVisao`: YOLOv8n treinado no RDD2022 (danos no pavimento), exportado para ONNX e rodado com onnxruntime.
  Não usa PyTorch nem Ultralytics, para caber no servidor gratuito. O pré e o pós-processamento
  reproduzem os do Ultralytics: letterbox para 640 px com cinza 114, pixels de 0 a 1, NMS por classe.

`detectar_cidadao`: foto do cidadão. YOLO primeiro; se não achar nada, a reserva multimodal (visao_reserva.py).

Treino e avaliação: Materias/VC/notebooks/01_rdd2022_treino_avaliacao.ipynb (fora da solução final).
"""
import hashlib
import io
import json
import logging
import time
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app import config
from app.providers import base_conhecimento as base
from app.schemas.visao import Deteccao, VisaoResultado

log = logging.getLogger(__name__)
CLASSES_MOCK = ["D40", "D00", "D20", "garbage", "drain_blocked"]
API_DIR = Path(__file__).resolve().parents[2]


class ImagemInvalida(ValueError):
    """A foto não pôde ser lida (arquivo corrompido ou formato não suportado)."""


class Visao(Protocol):
    def detectar(self, imagem: bytes, limiar: float | None = None) -> VisaoResultado: ...


class MockVisao:
    """Resultado determinístico a partir do hash da imagem (a mesma foto dá sempre o mesmo resultado)."""

    def detectar(self, imagem: bytes, limiar: float | None = None) -> VisaoResultado:
        inicio = time.perf_counter()
        h = hashlib.sha256(imagem).digest()
        classe = CLASSES_MOCK[h[0] % len(CLASSES_MOCK)]
        conf = 0.45 + (h[1] / 255) * 0.5
        cat = base.categoria_por_classe_visao(classe)
        det = Deteccao(classe=classe, categoria_id=cat.id if cat else None, confianca=round(conf, 2), bbox=(0.2, 0.3, 0.7, 0.8))
        return VisaoResultado(deteccoes=[det], modelo="mock", latencia_ms=(time.perf_counter() - inicio) * 1000)


def _nms(caixas, scores, iou_max: float) -> list[int]:
    """NMS clássico em numpy. `caixas` em x1,y1,x2,y2. Devolve os índices mantidos, do maior score ao menor."""
    import numpy as np

    x1, y1, x2, y2 = caixas.T
    areas = (x2 - x1) * (y2 - y1)
    ordem = scores.argsort()[::-1]
    manter = []
    while ordem.size:
        i = ordem[0]
        manter.append(int(i))
        resto = ordem[1:]
        xx1 = np.maximum(x1[i], x1[resto]); yy1 = np.maximum(y1[i], y1[resto])
        xx2 = np.minimum(x2[i], x2[resto]); yy2 = np.minimum(y2[i], y2[resto])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        iou = inter / (areas[i] + areas[resto] - inter + 1e-9)
        ordem = resto[iou <= iou_max]
    return manter


class YoloVisao:
    MAX_DET = 100

    def __init__(self, caminho_onnx: Path, caminho_info: Path):
        import numpy as np
        import onnxruntime as ort

        self.np = np
        info = json.loads(caminho_info.read_text(encoding="utf-8"))
        self.classes: list[str] = info["classes"]
        self.imgsz: int = int(info["imgsz"])
        self.limiares: dict[str, float] = {k: float(v) for k, v in info["limiares"].items()}
        self.limiar_padrao: float = config.YOLO_LIMIAR if config.YOLO_LIMIAR is not None else self.limiares["cidadao"]
        self.iou_nms: float = float(info.get("iou_nms", 0.6))
        self.nome = info.get("nome", f"yolov8n-{info['modelo_final']}")
        opcoes = ort.SessionOptions()
        opcoes.log_severity_level = 3
        self.sessao = ort.InferenceSession(str(caminho_onnx), sess_options=opcoes, providers=["CPUExecutionProvider"])
        self.entrada = self.sessao.get_inputs()[0].name

    # --- pré-processamento (igual ao LetterBox do Ultralytics) ---
    @staticmethod
    def abrir(imagem: bytes):
        from PIL import Image, ImageOps, UnidentifiedImageError

        try:
            im = Image.open(io.BytesIO(imagem))
            im = ImageOps.exif_transpose(im)  # foto de celular "deitada": usa a orientação que a pessoa vê
            return im.convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError) as e:
            raise ImagemInvalida("Não consegui ler a foto.") from e

    def preparar(self, im):
        """`im` é uma imagem PIL em RGB."""
        from PIL import Image

        np = self.np
        w, h = im.size
        r = min(self.imgsz / h, self.imgsz / w)
        nw, nh = int(round(w * r)), int(round(h * r))
        dw, dh = (self.imgsz - nw) / 2, (self.imgsz - nh) / 2
        esq, topo = int(round(dw - 0.1)), int(round(dh - 0.1))
        tela = Image.new("RGB", (self.imgsz, self.imgsz), (114, 114, 114))
        tela.paste(im if (nw, nh) == (w, h) else im.resize((nw, nh), Image.BILINEAR), (esq, topo))
        x = np.asarray(tela, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
        return x, (w, h), r, (esq, topo)

    # --- pós-processamento: saída (1, 4 + nc, N) com cx, cy, w, h em pixels da entrada ---
    def decodificar(self, saida, tam, r, pad, limiar: float):
        np = self.np
        p = saida[0].T  # (N, 4 + nc)
        scores_cls = p[:, 4:]
        cls = scores_cls.argmax(1)
        conf = scores_cls[np.arange(len(p)), cls]
        ok = conf >= limiar
        if not ok.any():
            return []
        p, cls, conf = p[ok], cls[ok], conf[ok]
        cx, cy, bw, bh = p[:, 0], p[:, 1], p[:, 2], p[:, 3]
        caixas = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
        # NMS por classe: desloca cada classe para uma região diferente do plano
        manter = _nms(caixas + cls[:, None] * 4096.0, conf, self.iou_nms)[: self.MAX_DET]
        w, h = tam
        out = []
        for i in manter:
            x1, y1, x2, y2 = caixas[i]
            x1 = float(np.clip((x1 - pad[0]) / r, 0, w)) / w
            x2 = float(np.clip((x2 - pad[0]) / r, 0, w)) / w
            y1 = float(np.clip((y1 - pad[1]) / r, 0, h)) / h
            y2 = float(np.clip((y2 - pad[1]) / r, 0, h)) / h
            out.append((self.classes[int(cls[i])], float(conf[i]), (x1, y1, x2, y2)))
        return out

    def detectar(self, imagem: bytes, limiar: float | None = None) -> VisaoResultado:
        inicio = time.perf_counter()
        return self.detectar_pil(self.abrir(imagem), limiar, inicio)

    def detectar_pil(self, im, limiar: float | None = None, inicio: float | None = None) -> VisaoResultado:
        """Mesma detecção, para quem já tem a imagem decodificada (ex.: quadros de vídeo da frota)."""
        inicio = inicio or time.perf_counter()
        x, tam, r, pad = self.preparar(im)
        saida = self.sessao.run(None, {self.entrada: x})[0]
        brutas = self.decodificar(saida, tam, r, pad, self.limiar_padrao if limiar is None else limiar)
        deteccoes = []
        for classe, conf, bbox in brutas:
            cat = base.categoria_por_classe_visao(classe)
            deteccoes.append(Deteccao(classe=classe, categoria_id=cat.id if cat else None,
                                      confianca=round(conf, 3), bbox=tuple(round(v, 4) for v in bbox)))
        return VisaoResultado(deteccoes=deteccoes, modelo=self.nome, latencia_ms=round((time.perf_counter() - inicio) * 1000, 1))


def caminho_modelo() -> Path:
    caminho = Path(config.YOLO_MODELO)
    return caminho if caminho.is_absolute() else API_DIR / caminho


@lru_cache
def _yolo() -> YoloVisao:
    caminho = caminho_modelo()
    if not caminho.exists():
        raise FileNotFoundError(f"Modelo de visão não encontrado em {caminho}. Confira YOLO_MODELO no .env.")
    return YoloVisao(caminho, caminho.with_suffix(".json"))


def obter_visao() -> Visao:
    if config.VISAO_PROVIDER == "mock":
        return MockVisao()
    if config.VISAO_PROVIDER == "yolo":
        return _yolo()
    raise NotImplementedError(f"Provedor de visão '{config.VISAO_PROVIDER}' não existe (use mock ou yolo)")


def detectar_cidadao(imagem: bytes) -> VisaoResultado:
    """Foto do cidadão: YOLO primeiro; se ele não achar nada, a reserva multimodal (se ligada) olha a foto borrada.

    A frota não passa por aqui: usa só o YOLO, com o limiar dela.
    """
    from app.providers.visao_reserva import ErroReserva, obter_reserva

    inicio = time.perf_counter()
    resultado = obter_visao().detectar(imagem)
    if resultado.deteccoes:
        return resultado
    try:
        reserva = obter_reserva()
        if reserva is None:
            return resultado
        from app.providers.privacidade import borrar_pil

        im, _ = borrar_pil(YoloVisao.abrir(imagem))
        deteccoes = reserva.classificar(im)
    except ErroReserva as e:
        log.warning("%s", e)  # sem reserva o app segue como antes: só o texto do cidadão
        # latência real (YOLO + a espera pela reserva), para a tela de qualidade mostrar o custo da falha
        return resultado.model_copy(update={"latencia_ms": round((time.perf_counter() - inicio) * 1000, 1)})
    return VisaoResultado(deteccoes=deteccoes, modelo=f"{resultado.modelo} + {reserva.nome}",
                          latencia_ms=round((time.perf_counter() - inicio) * 1000, 1))

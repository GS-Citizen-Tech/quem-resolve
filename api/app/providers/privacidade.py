"""Privacidade (LGPD): borra rostos, pessoas e placas antes de uma imagem sair da máquina.

Usado pela frota (vídeo anotado e recortes) e pela reserva multimodal da foto do cidadão
(a foto só vai para o provedor externo depois de borrada).
"""
from pathlib import Path

import cv2
import numpy as np


class Borrador:
    """Borra rostos, pessoas e placas. Usa detectores que já vêm no OpenCV (Haar para rosto e placa, HOG para pessoa
    inteira): simples e rápidos, mas não perfeitos. Por isso o vídeo bruto nunca sai da máquina e só ficam os
    recortes do dano e o vídeo anotado, já borrados."""

    LARGURA = 640  # os detectores rodam numa cópia reduzida (bem mais rápido); as caixas voltam para o tamanho real

    def __init__(self):
        base = Path(cv2.data.haarcascades)
        self.rosto = cv2.CascadeClassifier(str(base / "haarcascade_frontalface_default.xml"))
        self.placa = cv2.CascadeClassifier(str(base / "haarcascade_russian_plate_number.xml"))
        self.pessoa = cv2.HOGDescriptor()
        self.pessoa.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def regioes(self, img) -> list[tuple[int, int, int, int]]:
        esc = min(1.0, self.LARGURA / img.shape[1])
        peq = cv2.resize(img, None, fx=esc, fy=esc, interpolation=cv2.INTER_AREA) if esc < 1 else img
        cinza = cv2.cvtColor(peq, cv2.COLOR_BGR2GRAY)
        h = peq.shape[0]
        rs = []
        for det, minimo, vizinhos in ((self.rosto, max(12, h // 45), 5), (self.placa, max(10, h // 70), 6)):
            for (x, y, w, hh) in det.detectMultiScale(cinza, scaleFactor=1.1, minNeighbors=vizinhos, minSize=(minimo, minimo)):
                rs.append((x, y, w, hh))
        if peq.shape[0] >= 128:
            caixas, pesos = self.pessoa.detectMultiScale(peq, winStride=(8, 8), padding=(8, 8), scale=1.08)
            rs += [tuple(c) for c, p in zip(caixas, np.ravel(pesos)) if p > 0.5]
        return [tuple(int(round(v / esc)) for v in r) for r in rs]

    def aplicar(self, img, regioes) -> int:
        for (x, y, w, h) in regioes:
            pad = int(0.15 * max(w, h))
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
            roi = img[y0:y1, x0:x1]
            if roi.size:
                k = max(15, (max(w, h) // 2) | 1)
                img[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (k, k), 0)
        return len(regioes)


_borrador: "Borrador | None" = None


def borrar_pil(im):
    """Recebe uma imagem PIL em RGB e devolve (cópia borrada em RGB, número de regiões borradas)."""
    from PIL import Image

    global _borrador
    if _borrador is None:
        _borrador = Borrador()
    bgr = cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR)
    n = _borrador.aplicar(bgr, _borrador.regioes(bgr))
    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), n

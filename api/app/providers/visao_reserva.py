"""Reserva multimodal da foto do cidadão (Gemini Flash).

O YOLO só conhece dano no pavimento. Quando ele não acha nada, a foto (já borrada: rostos, pessoas e placas)
vai para um modelo multimodal com a lista das categorias do Quem Resolve, e ele devolve em JSON:
a categoria, a confiança, uma frase curta e, se conseguir, a caixa do problema.

Regras:
- A confiança informada pelo modelo é um palpite dele, não foi calibrada como a do YOLO. Por isso ela é
  limitada logo abaixo de LIMIAR_CONFIANCA: a resposta da reserva sempre pede confirmação do cidadão.
- Qualquer falha (sem chave, fora do ar, timeout, JSON inválido) vira `ErroReserva`, e o app segue sem detecção.
- A frota nunca usa a reserva (custo e volume): só o YOLO.
"""
import base64
import io
import json
import time
from typing import Protocol

from app import config
from app.providers import base_conhecimento as base
from app.schemas.visao import Deteccao

URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
LADO_MAX = 1024  # a foto vai reduzida: mais rápido, mais barato e suficiente para reconhecer o problema


class ErroReserva(Exception):
    """A reserva não respondeu ou respondeu algo inválido."""


class Reserva(Protocol):
    nome: str

    def classificar(self, im) -> list[Deteccao]: ...


def _limitar(conf: float) -> float:
    return round(max(0.0, min(float(conf), config.LIMIAR_CONFIANCA - 0.01)), 2)


def _prompt() -> str:
    linhas = "\n".join(f"- {c.id}: {c.nome}" for c in base.categorias().values())
    return (
        "Você ajuda a prefeitura de São Paulo a fazer a triagem de fotos enviadas por cidadãos.\n"
        "Diga qual problema urbano aparece na foto, escolhendo UMA das categorias abaixo (use o id).\n"
        f"{linhas}\n"
        "Se a foto não mostrar nenhum desses problemas, use categoria_id = \"nenhum\".\n"
        "confianca: de 0 a 1, o quanto você tem certeza.\n"
        "descricao: uma frase curta em português simples sobre o que você vê (ex.: \"Fio caído sobre a calçada\").\n"
        "caixa: [ymin, xmin, ymax, xmax] do problema, de 0 a 1000; use [] se o problema ocupa a foto toda ou não dá para marcar.\n"
        "Rostos e placas foram borrados de propósito. Não descreva pessoas."
    )


ESQUEMA = {
    "type": "object",
    "properties": {
        "categoria_id": {"type": "string", "enum": None},  # preenchido com as categorias + "nenhum"
        "confianca": {"type": "number"},
        "descricao": {"type": "string"},
        "caixa": {"type": "array", "items": {"type": "number"}},
    },
    "required": ["categoria_id", "confianca", "descricao"],
}


def interpretar(texto: str) -> list[Deteccao]:
    """Converte o JSON do modelo em detecções do contrato. Lista vazia = nenhum problema na foto."""
    try:
        r = json.loads(texto)
        cid = r["categoria_id"]
        conf = float(r["confianca"])
    except (ValueError, KeyError, TypeError) as e:
        raise ErroReserva(f"Resposta inválida da reserva: {texto[:200]!r}") from e
    if cid == "nenhum" or cid not in base.categorias():
        return []
    bbox = None
    caixa = r.get("caixa") or []
    if len(caixa) == 4:
        y1, x1, y2, x2 = (max(0.0, min(1.0, float(v) / 1000)) for v in caixa)
        if x2 > x1 and y2 > y1:
            bbox = (round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4))
    descricao = (r.get("descricao") or "").strip()[:200] or base.categoria(cid).nome
    return [Deteccao(classe=cid, categoria_id=cid, confianca=_limitar(conf), bbox=bbox, origem="multimodal", descricao=descricao)]


class MockReserva:
    """Para testes e para desenvolver o front sem chave: sempre 'descarte irregular'."""

    nome = "mock-multimodal"

    def classificar(self, im) -> list[Deteccao]:
        return interpretar(json.dumps({"categoria_id": "descarte_irregular", "confianca": 0.8,
                                       "descricao": "Entulho jogado na calçada", "caixa": [300, 200, 900, 800]}))


class GeminiReserva:
    """`modelo` aceita uma lista separada por vírgula: se o primeiro estiver sobrecarregado (429/5xx) ou demorar
    demais, tenta o próximo, sempre dentro do mesmo tempo máximo. Enquanto houver outro modelo na lista, cada um usa
    no máximo 60% do tempo que sobra, para o próximo ainda ter chance."""

    def __init__(self, modelo: str, chave: str, timeout: float, transporte=None):
        if not chave:
            raise ErroReserva("Sem chave para a reserva multimodal (VISAO_RESERVA_CHAVE ou LLM_API_KEY).")
        self.modelos = [m.strip() for m in modelo.split(",") if m.strip()]
        self.nome, self.chave, self.timeout, self.transporte = self.modelos[0], chave, timeout, transporte

    def _corpo(self, im) -> dict:
        im = im.copy()
        im.thumbnail((LADO_MAX, LADO_MAX))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85)  # salvar de novo também descarta qualquer EXIF
        esquema = json.loads(json.dumps(ESQUEMA))
        esquema["properties"]["categoria_id"]["enum"] = [*base.categorias(), "nenhum"]
        return {
            "contents": [{"parts": [
                {"text": _prompt()},
                {"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}},
            ]}],
            "generationConfig": {
                "temperature": 0,
                "thinkingConfig": {"thinkingLevel": "low"},
                "responseMimeType": "application/json",
                "responseJsonSchema": esquema,
            },
        }

    def classificar(self, im) -> list[Deteccao]:
        import httpx

        corpo, fim = self._corpo(im), time.monotonic() + self.timeout
        erro = None
        with httpx.Client(transport=self.transporte) as c:
            for i, modelo in enumerate(self.modelos):
                resta = fim - time.monotonic()
                if resta < 0.5:
                    break
                ultimo = i == len(self.modelos) - 1
                limite = resta if ultimo else max(min(resta, 3.0), resta * 0.6)
                t0 = time.monotonic()
                try:
                    r = c.post(URL_GEMINI.format(modelo=modelo), json=corpo, headers={"x-goog-api-key": self.chave}, timeout=limite)
                    if r.status_code == 429 or r.status_code >= 500:
                        erro = f"{modelo} respondeu {r.status_code}"
                        continue  # sobrecarregado: tenta o próximo modelo da lista
                    r.raise_for_status()
                    partes = r.json()["candidates"][0]["content"]["parts"]
                    texto = "".join(p.get("text", "") for p in partes if not p.get("thought"))
                except httpx.TimeoutException:
                    erro = f"{modelo} não respondeu em {time.monotonic() - t0:.1f} s"
                    continue  # demorou: tenta o próximo modelo com o tempo que sobra
                except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
                    raise ErroReserva(f"Reserva multimodal falhou ({modelo}): {e}") from e
                self.nome = modelo
                return interpretar(texto)
        raise ErroReserva(f"Reserva multimodal indisponível: {erro or 'tempo esgotado'}")


def obter_reserva() -> Reserva | None:
    """None quando a reserva está desligada."""
    if config.VISAO_RESERVA == "off":
        return None
    if config.VISAO_RESERVA == "mock":
        return MockReserva()
    if config.VISAO_RESERVA == "gemini":
        return GeminiReserva(config.VISAO_RESERVA_MODELO, config.VISAO_RESERVA_CHAVE, config.VISAO_RESERVA_TIMEOUT)
    raise ErroReserva(f"Reserva '{config.VISAO_RESERVA}' não existe (use off, mock ou gemini)")

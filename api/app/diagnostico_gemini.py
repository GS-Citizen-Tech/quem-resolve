"""Diagnóstico da reserva multimodal: manda uma foto de teste para cada modelo da lista e mede o tempo.
Rodar dentro de api/:   .venv\\Scripts\\python -m app.diagnostico_gemini  [caminho-da-foto.jpg]
Mostra só o status e o tempo de cada modelo (a chave do .env não aparece)."""
import sys
import time
from pathlib import Path

import httpx
from PIL import Image

from app import config
from app.providers.visao_reserva import URL_GEMINI, GeminiReserva


def main() -> None:
    foto = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "rua_rdd2022.jpg"
    if not config.VISAO_RESERVA_CHAVE:
        raise SystemExit("VISAO_RESERVA_CHAVE (ou LLM_API_KEY) vazia no api/.env.")
    g = GeminiReserva(config.VISAO_RESERVA_MODELO, config.VISAO_RESERVA_CHAVE, 60)
    corpo = g._corpo(Image.open(foto).convert("RGB"))
    print(f"Foto: {foto.name} · modelos: {', '.join(g.modelos)} · tempo máximo no app: {config.VISAO_RESERVA_TIMEOUT:.0f} s\n")
    with httpx.Client(timeout=60) as c:
        for m in g.modelos:
            t0 = time.monotonic()
            try:
                r = c.post(URL_GEMINI.format(modelo=m), json=corpo, headers={"x-goog-api-key": g.chave})
                seg = time.monotonic() - t0
                detalhe = r.json().get("error", {}).get("message", "")[:120] if r.status_code != 200 else "ok"
                print(f"{m:28s} HTTP {r.status_code}  {seg:5.1f} s  {detalhe}")
            except httpx.HTTPError as e:
                print(f"{m:28s} falhou em {time.monotonic() - t0:5.1f} s: {e.__class__.__name__}")


if __name__ == "__main__":
    main()

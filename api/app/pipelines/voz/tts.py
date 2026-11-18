"""TTS em português do Brasil.

- Piper (local, padrão): o texto não sai da máquina.
- edge-tts (nuvem Microsoft): voz mais natural, mas o texto da resposta é enviado
  a um serviço externo. Usado como segunda opção e na comparação de TTS.
"""
import asyncio
import tempfile
import threading
import urllib.request
import wave
from pathlib import Path

URL_PIPER = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/"


def baixar_voz_piper(destino: str | Path) -> Path:
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    for arq in (destino.name, destino.name + ".json"):
        alvo = destino.parent / arq
        if not alvo.exists():
            print(f"Baixando {arq}...")
            urllib.request.urlretrieve(URL_PIPER + arq, alvo)
    return destino


def _arquivo_temp(sufixo: str) -> str:
    return tempfile.NamedTemporaryFile(prefix="resposta_", suffix=sufixo, delete=False).name


class SintetizadorPiper:
    def __init__(self, caminho_modelo: str):
        from piper import PiperVoice

        caminho = Path(caminho_modelo)
        if not caminho.exists():
            baixar_voz_piper(caminho)
        self.nome = f"piper-{caminho.stem}"
        self.voz = PiperVoice.load(str(caminho))

    def sintetizar(self, texto: str, saida: str | None = None) -> str:
        saida = saida or _arquivo_temp(".wav")
        with wave.open(saida, "wb") as wf:
            if hasattr(self.voz, "synthesize_wav"):   # piper-tts >= 1.3
                self.voz.synthesize_wav(texto, wf)
            else:                                     # piper-tts 1.2
                self.voz.synthesize(texto, wf)
        return saida


class SintetizadorEdge:
    def __init__(self, voz: str = "pt-BR-FranciscaNeural"):
        self.voz = voz
        self.nome = f"edge-{voz}"

    def sintetizar(self, texto: str, saida: str | None = None) -> str:
        import edge_tts

        saida = saida or _arquivo_temp(".mp3")

        async def _rodar():
            await edge_tts.Communicate(texto, self.voz).save(saida)

        # Funciona tanto em script quanto dentro do Jupyter/Colab (que já tem um loop rodando).
        erro: list[Exception] = []

        def _thread():
            try:
                asyncio.run(_rodar())
            except Exception as e:  # noqa: BLE001
                erro.append(e)

        t = threading.Thread(target=_thread)
        t.start()
        t.join()
        if erro:
            raise erro[0]
        return saida


def criar_sintetizador(motor: str, piper_voz: str, edge_voz: str):
    if motor == "edge":
        return SintetizadorEdge(edge_voz)
    return SintetizadorPiper(piper_voz)

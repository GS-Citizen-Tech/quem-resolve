"""STT: transcrição em português com faster-whisper (roda local, o áudio não sai da máquina)."""

# Vocabulário do domínio para ajudar o Whisper com nomes próprios e siglas.
PROMPT_DOMINIO = ("Zeladoria em São Paulo: SP156, subprefeitura, Enel, Sabesp, Comgás, CET, "
                  "Defesa Civil, boca de lobo, bueiro, entulho, poste, calçada, Ecoponto.")


def _tem_cuda() -> bool:
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


class TranscritorWhisper:
    def __init__(self, modelo: str = "small", device: str = "auto", compute_type: str | None = None,
                 usar_prompt_dominio: bool = True):
        from faster_whisper import WhisperModel

        if device == "auto":
            device = "cuda" if _tem_cuda() else "cpu"
        compute_type = compute_type or ("float16" if device == "cuda" else "int8")
        self.nome = f"faster-whisper-{modelo}"
        self.usar_prompt_dominio = usar_prompt_dominio
        self.modelo = WhisperModel(modelo, device=device, compute_type=compute_type)

    def transcrever_detalhado(self, caminho_audio: str) -> tuple[str, float]:
        """Retorna (texto, duração do áudio em segundos)."""
        segmentos, info = self.modelo.transcribe(
            caminho_audio,
            language="pt",
            beam_size=5,
            vad_filter=True,  # corta silêncios e reduz alucinação em trechos sem fala
            initial_prompt=PROMPT_DOMINIO if self.usar_prompt_dominio else None,
        )
        texto = " ".join(s.text.strip() for s in segmentos).strip()
        return texto, float(info.duration)

    def transcrever(self, caminho_audio: str) -> str:
        return self.transcrever_detalhado(caminho_audio)[0]

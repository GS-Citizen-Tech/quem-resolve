"""Cliente de LLM para qualquer endpoint compatível com a API da OpenAI.

Exemplos de LLM_BASE_URL:
  Groq:   https://api.groq.com/openai/v1
  Gemini: https://generativelanguage.googleapis.com/v1beta/openai/
  Ollama: http://localhost:11434/v1   (LLM_API_KEY=ollama)

Atenção: a Groq desligou o Llama 3.3 70B e o Llama 3.1 8B em 16/08/2026.
Os substitutos recomendados são openai/gpt-oss-120b e openai/gpt-oss-20b.
Lista atual: https://console.groq.com/docs/models
"""
import re


class ModeloIndisponivel(RuntimeError):
    pass


class ClienteLLM:
    def __init__(self, base_url: str, api_key: str, modelo: str, temperatura: float = 0.2,
                 max_tokens: int = 300, timeout: float = 30.0):
        from openai import OpenAI

        self.nome = modelo
        self.modelo = modelo
        self.temperatura = temperatura
        self.raciocinio = "gpt-oss" in modelo  # modelos que "pensam" antes de responder
        # O raciocínio também consome tokens de saída: sem folga, a resposta final sai vazia.
        self.max_tokens = max(max_tokens, 1024) if self.raciocinio else max_tokens
        self.cliente = OpenAI(base_url=base_url, api_key=api_key or "sem-chave", timeout=timeout, max_retries=2)

    def responder(self, mensagens: list[dict]) -> str:
        extra = {"reasoning_effort": "low"} if self.raciocinio else None  # menos raciocínio = menos latência
        try:
            r = self.cliente.chat.completions.create(
                model=self.modelo, messages=mensagens, temperature=self.temperatura,
                max_tokens=self.max_tokens, extra_body=extra,
            )
        except Exception as e:  # noqa: BLE001
            if "model_not_found" in str(e) or "decommissioned" in str(e) or "does not exist" in str(e):
                raise ModeloIndisponivel(
                    f"O modelo '{self.modelo}' não existe mais neste provedor. "
                    "Veja os modelos atuais em https://console.groq.com/docs/models e troque LLM_MODELO.") from e
            raise
        texto = r.choices[0].message.content or ""
        # Alguns modelos (ex.: Qwen3, DeepSeek-R1) devolvem o raciocínio entre <think> no próprio texto.
        texto = re.sub(r"<think>.*?</think>", "", texto, flags=re.S)
        return texto.strip()


def listar_modelos(base_url: str, api_key: str) -> list[str]:
    """Modelos disponíveis no provedor (útil para conferir antes de rodar os testes)."""
    from openai import OpenAI

    return sorted(m.id for m in OpenAI(base_url=base_url, api_key=api_key or "sem-chave").models.list().data)

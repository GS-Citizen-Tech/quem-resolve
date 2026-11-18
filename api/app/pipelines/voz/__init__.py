"""Assistente de voz (disciplina 08 · PLN, parceiro), integrado à API.

Copiado de `GS PLN/quem-resolve-voz/pipelines/voz/` (módulo avaliado na disciplina), sem mudar a lógica:

| Arquivo             | Função                                                                  |
|---------------------|-------------------------------------------------------------------------|
| `stt.py`            | faster-whisper local, `language="pt"`, VAD e vocabulário do domínio     |
| `rag.py`            | base "quem resolve o quê" + FAQ (`app/data/voz/`), MiniLM multilíngue   |
| `llm.py`            | qualquer endpoint compatível com OpenAI (Groq gpt-oss-120b por padrão)  |
| `prompts.py`        | system prompt: papel, tom, limites                                      |
| `memoria.py`        | últimos turnos da conversa (vem do `historico` do front, a API não guarda) |
| `adaptacao_fala.py` | texto → fala: sem markdown, telefones dígito a dígito, siglas, números  |
| `tts.py`            | Piper local (padrão) ou edge-tts                                        |

O que fica na API (não veio do módulo): o guardrail (`app/pipelines/guardrail.py`, o mesmo do reporte e do
chat), a medição de latência e o registro em `repositorio.registrar_voz`. A ligação entre as peças está em
`app/providers/voz.py` (`RealVoz`), escolhida com `VOZ_PROVIDER=real`.

As bibliotecas pesadas (faster-whisper, sentence-transformers, piper-tts, openai) estão em
`requirements-voz.txt` e só são importadas quando o provedor real é usado.
"""

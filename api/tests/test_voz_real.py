"""Voz real (VOZ_PROVIDER=real) com componentes falsos: testa a ligação do módulo de PLN na API
sem baixar Whisper, MiniLM nem Piper (rodam no CI leve). O teste com os modelos de verdade é manual (README)."""
import base64
import json
import os
import tempfile

import pytest

from app import config
from app.pipelines.voz.rag import Documento
from app.providers import voz as voz_mod


class FakeSTT:
    nome = "fake-whisper"

    def __init__(self, texto):
        self.texto, self.recebido = texto, None

    def transcrever(self, arquivo):
        self.recebido = arquivo.read()  # chega em memória (BytesIO), nunca como caminho em disco
        return self.texto


class FakeRAG:
    def __init__(self, achados=True):
        self.achados, self.anterior = achados, None

    def buscar(self, pergunta, anterior=""):
        self.anterior = anterior
        if not self.achados:
            return []
        doc = Documento("fio_telecom", "Fio de internet ou telefone", "Quem resolve: a operadora dona do cabo.",
                        "SP Regula", "https://www.prefeitura.sp.gov.br/")
        return [(doc, 0.71)]


class FakeLLM:
    nome = "fake-llm"

    def __init__(self, texto="Quem resolve é a operadora. Ligue para o SP156 no 156.", erro=None):
        self.texto, self.erro, self.mensagens = texto, erro, None

    def responder(self, mensagens):
        self.mensagens = mensagens
        if self.erro:
            raise self.erro
        return self.texto


class FakeTTS:
    def __init__(self):
        self.chamadas, self.arquivos = 0, []

    def sintetizar(self, texto):
        self.chamadas += 1
        f = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        f.write(b"RIFF-fake")
        f.close()
        self.arquivos.append(f.name)
        return f.name


@pytest.fixture
def real(monkeypatch):
    """Liga VOZ_PROVIDER=real com componentes falsos e devolve uma função para trocá-los."""
    monkeypatch.setattr(config, "VOZ_PROVIDER", "real")
    monkeypatch.setattr(config, "VOZ_TTS_MOTOR", "piper")

    def montar(texto="Tem um fio pendurado na frente da minha casa, quem eu chamo?", **kw):
        partes = {"stt": FakeSTT(texto), "rag": FakeRAG(), "llm": FakeLLM(), "tts": FakeTTS(), **kw}
        monkeypatch.setattr(voz_mod, "_real", voz_mod.RealVoz(**partes))
        return partes
    return montar


def _enviar(client, historico=None):
    data = {"historico": json.dumps(historico)} if historico else None
    return client.post("/voz/conversar", files={"audio": ("fala.webm", b"audio-bytes", "audio/webm")}, data=data)


def test_fluxo_completo_com_pln(client, real):
    p = real()
    r = _enviar(client)
    assert r.status_code == 200
    d = r.json()
    assert p["stt"].recebido == b"audio-bytes"
    assert d["transcricao"].startswith("Tem um fio")
    assert d["resposta"]["resposta"].startswith("Quem resolve é a operadora")
    assert d["resposta"]["modelo"] == "fake-llm + MiniLM-L12 multilíngue"
    assert d["resposta"]["sem_fonte"] is False and d["resposta"]["fora_do_tema"] is False
    assert d["resposta"]["fontes"][0] == {"titulo": "SP Regula - Fio de internet ou telefone",
                                          "url": "https://www.prefeitura.sp.gov.br/",
                                          "trecho": "Quem resolve: a operadora dona do cabo."}
    # adaptação para fala do módulo de PLN: SP156 e 156 pronunciáveis
    assert "ésse pê cento e cinquenta e seis" in d["texto_falado"] and "um cinco meia" in d["texto_falado"]
    assert base64.b64decode(d["audio_base64"]) == b"RIFF-fake"
    assert all(not os.path.exists(a) for a in p["tts"].arquivos)  # o WAV da resposta é apagado
    assert set(d["latencias"]) == {"stt_ms", "llm_ms", "tts_ms", "total_ate_fala_ms"}


def test_historico_vira_memoria_do_llm(client, real):
    p = real(texto="E qual é o telefone deles?")
    hist = [{"papel": "cidadao", "texto": "Tem um fio pendurado"}, {"papel": "assistente", "texto": "É a operadora."}]
    assert _enviar(client, hist).status_code == 200
    assert p["rag"].anterior == "Tem um fio pendurado"  # continuação busca junto com a pergunta anterior
    papeis = [m["role"] for m in p["llm"].mensagens]
    assert papeis == ["system", "user", "assistant", "system", "user"]
    assert p["llm"].mensagens[-1]["content"] == "E qual é o telefone deles?"


def test_emergencia_nao_chama_llm_nem_tts(client, real):
    p = real(texto="Tem um poste pegando fogo aqui na rua")
    d = _enviar(client).json()
    assert d["resposta"]["guardrail"]["nivel"] == 1 and d["resposta"]["modelo"] == "guardrail"
    assert p["llm"].mensagens is None and p["tts"].chamadas == 0
    assert d["audio_base64"] is None


def test_violencia_domestica_nao_e_falada(client, real):
    p = real(texto="Meu marido me bate todo dia")
    d = _enviar(client).json()
    assert d["resposta"]["guardrail"]["saida_rapida"] is True
    assert p["tts"].chamadas == 0 and d["audio_base64"] is None


def test_nivel_3_responde_com_aviso(client, real):
    p = real(texto="Tem um fio faiscando na calçada, quem eu chamo?")
    d = _enviar(client).json()
    assert d["resposta"]["guardrail"]["nivel"] == 3
    assert p["llm"].mensagens is not None and d["audio_base64"]


def test_sem_fonte_e_fora_do_tema(client, real):
    real(texto="Qual a receita de bolo de cenoura?", rag=FakeRAG(achados=False),
         llm=FakeLLM("Desculpe, eu só consigo ajudar com problemas na rua e nos serviços da cidade."))
    d = _enviar(client).json()["resposta"]
    assert d["sem_fonte"] is True and d["fora_do_tema"] is True and d["fontes"] == []


def test_llm_fora_do_ar_indica_156(client, real):
    real(llm=FakeLLM(erro=TimeoutError("groq")))
    r = _enviar(client)
    assert r.status_code == 200
    assert "156" in r.json()["resposta"]["resposta"] and r.json()["resposta"]["sem_fonte"] is True


def test_audio_sem_fala(client, real):
    p = real(texto="")
    d = _enviar(client).json()
    assert "não consegui entender o áudio" in d["resposta"]["resposta"]
    assert p["llm"].mensagens is None


def test_audio_ilegivel_da_422(client, real):
    class STTQuebrado:
        def transcrever(self, arquivo):
            raise ValueError("Invalid data found when processing input")
    real(stt=STTQuebrado())
    assert _enviar(client).status_code == 422


def test_tts_quebrado_cai_na_voz_do_navegador(client, real):
    class TTSQuebrado:
        def sintetizar(self, texto):
            raise RuntimeError("onnx")
    real(tts=TTSQuebrado())
    d = _enviar(client).json()
    assert d["audio_base64"] is None and d["texto_falado"]


def test_tts_off(client, real, monkeypatch):
    p = real()
    monkeypatch.setattr(config, "VOZ_TTS_MOTOR", "off")
    assert _enviar(client).json()["audio_base64"] is None and p["tts"].chamadas == 0


def test_health_mostra_voz_real(client, real):
    real()
    assert client.get("/health").json()["modulos"]["voz"] == "real"

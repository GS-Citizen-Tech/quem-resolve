"""Configuração por variáveis de ambiente (segredos nunca vão para o repositório)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _lista(nome: str, padrao: str) -> list[str]:
    return [v.strip() for v in os.getenv(nome, padrao).split(",") if v.strip()]


# Qual implementação usar em cada módulo: "mock" até o módulo real ficar pronto.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock")          # mock | gemini | groq
VISAO_PROVIDER = os.getenv("VISAO_PROVIDER", "mock")      # mock | yolo
RAG_PROVIDER = os.getenv("RAG_PROVIDER", "mock")          # mock | real
VOZ_PROVIDER = os.getenv("VOZ_PROVIDER", "mock")          # mock | real

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")
YOLO_MODELO = os.getenv("YOLO_MODELO", "modelos/rdd2022-n-r2.onnx")  # o .json com classes e limiares fica ao lado
YOLO_LIMIAR = float(os.environ["YOLO_LIMIAR"]) if os.getenv("YOLO_LIMIAR") else None  # vazio = limiar do cidadão escolhido no treino

# Reserva multimodal da foto do cidadão: entra quando o YOLO não acha nada (fio, lixo, poste, árvore, alagamento...).
VISAO_RESERVA = os.getenv("VISAO_RESERVA", "off")                    # off | mock | gemini
VISAO_RESERVA_MODELO = os.getenv("VISAO_RESERVA_MODELO", "gemini-3.5-flash,gemini-3.8-flash")  # lista: tenta o próximo se o primeiro estiver sobrecarregado
VISAO_RESERVA_CHAVE = os.getenv("VISAO_RESERVA_CHAVE", "") or os.getenv("LLM_API_KEY", "")  # vazio = usa a chave do LLM
VISAO_RESERVA_TIMEOUT = float(os.getenv("VISAO_RESERVA_TIMEOUT", "8"))

CORS_ORIGINS = _lista("CORS_ORIGINS", "http://localhost:3000")
LIMIAR_CONFIANCA = float(os.getenv("LIMIAR_CONFIANCA", "0.5"))  # abaixo disso: confiança baixa, pede confirmação
LIMIAR_IOT = float(os.getenv("LIMIAR_IOT", "0.7"))
SEED_OCORRENCIAS = int(os.getenv("SEED_OCORRENCIAS", "120"))

# Login de demonstração do gestor: "usuario:senha:orgao_id:Nome", separados por vírgula.
GESTORES = _lista("GESTORES", "marina:demo-123:subprefeitura:Marina")
AUTH_SEGREDO = os.getenv("AUTH_SEGREDO", "troque-este-segredo-em-producao")
AUTH_HORAS = int(os.getenv("AUTH_HORAS", "8"))
ROBO_CHAVE = os.getenv("ROBO_CHAVE", "")  # chave do robô de RPA (vazia = robô desligado)

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
VISAO_RESERVA_MODELO = os.getenv("VISAO_RESERVA_MODELO", "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash")  # lista: tenta o próximo se um estiver sobrecarregado, lento ou sem cota. O lite vem 1º: no teste de 12/11 respondeu em 1,4 s, o flash travou e o 3.8 estava sobrecarregado
VISAO_RESERVA_CHAVE = os.getenv("VISAO_RESERVA_CHAVE", "") or os.getenv("LLM_API_KEY", "")  # vazio = usa a chave do LLM
VISAO_RESERVA_TIMEOUT = float(os.getenv("VISAO_RESERVA_TIMEOUT", "12"))  # total, somando os modelos da lista

CORS_ORIGINS = _lista("CORS_ORIGINS", "http://localhost:3000")
LIMIAR_CONFIANCA = float(os.getenv("LIMIAR_CONFIANCA", "0.5"))  # abaixo disso: confiança baixa, pede confirmação
LIMIAR_IOT = float(os.getenv("LIMIAR_IOT", "0.7"))
SEED_OCORRENCIAS = int(os.getenv("SEED_OCORRENCIAS", "120"))

# Banco: vazio = memória (some ao reiniciar). Supabase: "Session pooler" em Project Settings > Database.
DATABASE_URL = os.getenv("DATABASE_URL", "")
# Fotos: vazio = memória. Supabase: Project Settings > API (URL e a chave "secret"/service_role, só aqui na API).
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_CHAVE_SECRETA = os.getenv("SUPABASE_CHAVE_SECRETA", "")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "fotos")
LINK_FOTO_MINUTOS = int(os.getenv("LINK_FOTO_MINUTOS", "60"))  # o link da foto para o gestor vale por 1 hora
RETENCAO_DIAS = int(os.getenv("RETENCAO_DIAS", "90"))  # fotos e descrição somem 90 dias depois de resolvida

# Login de demonstração do gestor: "usuario:senha:orgao_id:Nome", separados por vírgula.
GESTORES = _lista("GESTORES", "marina:demo-123:subprefeitura:Marina,joao:demo-123:sabesp:João")
AUTH_SEGREDO = os.getenv("AUTH_SEGREDO", "troque-este-segredo-em-producao")
AUTH_HORAS = int(os.getenv("AUTH_HORAS", "8"))
ROBO_CHAVE = os.getenv("ROBO_CHAVE", "")  # chave do robô de RPA (vazia = robô desligado)

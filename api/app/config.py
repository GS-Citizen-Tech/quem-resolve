"""Configuração por variáveis de ambiente (segredos nunca vão para o repositório)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _lista(nome: str, padrao: str) -> list[str]:
    return [v.strip() for v in os.getenv(nome, padrao).split(",") if v.strip()]


# Qual implementação usar em cada módulo: "mock" até o módulo real ficar pronto.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock")          # mock | gemini
VISAO_PROVIDER = os.getenv("VISAO_PROVIDER", "mock")      # mock | yolo
RAG_PROVIDER = os.getenv("RAG_PROVIDER", "mock")          # mock | real
VOZ_PROVIDER = os.getenv("VOZ_PROVIDER", "mock")          # mock | real
GEO_PROVIDER = os.getenv("GEO_PROVIDER", "nominatim")     # mock | nominatim (endereço por extenso, v1.1)

LLM_API_KEY = os.getenv("LLM_API_KEY", "") or os.getenv("VISAO_RESERVA_CHAVE", "")  # uma chave do Gemini serve para os dois
# Lista: se um modelo estiver sem cota (429), sobrecarregado ou lento, tenta o próximo.
LLM_MODEL = os.getenv("LLM_MODEL", "") or "gemini-3.5-flash-lite,gemini-3.5-flash"
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "10"))  # total, somando os modelos da lista

# RAG real (RAG_PROVIDER=real, disciplina 05): pipeline do notebook GS-GENAI-CITIZENTECH sobre a base app/data/voz.
# Chat de texto e voz usam o mesmo RAG. LLM = Gemini, com a mesma chave da análise do relato se RAG_LLM_API_KEY ficar vazio.
RAG_LLM_API_KEY = os.getenv("RAG_LLM_API_KEY", "") or LLM_API_KEY
RAG_LLM_MODELO = os.getenv("RAG_LLM_MODELO", "") or LLM_MODEL
RAG_LLM_TIMEOUT = float(os.getenv("RAG_LLM_TIMEOUT", "20"))           # total, somando os modelos da lista
RAG_EMBEDDINGS = os.getenv("RAG_EMBEDDINGS", "intfloat/multilingual-e5-small")
RAG_RERANKER = os.getenv("RAG_RERANKER", "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1")  # vazio = sem reranker (híbrido puro)
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
RAG_CANDIDATOS = int(os.getenv("RAG_CANDIDATOS", "20"))                # candidatos que o reranker reordena
RAG_LIMIAR = float(os.getenv("RAG_LIMIAR", "0.82"))                    # gate: abaixo disso abstém sem chamar o LLM. Calibrado em 17/11 (scripts/calibrar_rag.py): tema mín 0,846, fora máx 0,850
RAG_AQUECER = os.getenv("RAG_AQUECER", "1") == "1"                     # carrega E5 + reranker na subida da API

# Voz real (VOZ_PROVIDER=real, disciplina 08): STT faster-whisper + RAG MiniLM + LLM compatível com OpenAI + TTS Piper.
# Variáveis próprias (prefixo VOZ_) para não misturar com a chave do Gemini usada na visão.
VOZ_STT_MODELO = os.getenv("VOZ_STT_MODELO", "small")                  # tiny | base | small | medium (em CPU: small)
VOZ_STT_DEVICE = os.getenv("VOZ_STT_DEVICE", "cpu")                    # cpu | cuda | auto
VOZ_LLM_BASE_URL = os.getenv("VOZ_LLM_BASE_URL", "https://api.groq.com/openai/v1")
VOZ_LLM_API_KEY = os.getenv("VOZ_LLM_API_KEY", "")  # própria: a LLM_API_KEY é a do Gemini (análise do relato)
VOZ_LLM_MODELO = os.getenv("VOZ_LLM_MODELO", "openai/gpt-oss-120b")
VOZ_TTS_MOTOR = os.getenv("VOZ_TTS_MOTOR", "piper")                    # piper (local) | edge (nuvem Microsoft) | off (voz do navegador)
VOZ_PIPER_VOZ = os.getenv("VOZ_PIPER_VOZ", "modelos/piper/pt_BR-faber-medium.onnx")  # baixa sozinha se faltar
VOZ_EDGE_VOZ = os.getenv("VOZ_EDGE_VOZ", "pt-BR-FranciscaNeural")
VOZ_RAG_LIMIAR = float(os.getenv("VOZ_RAG_LIMIAR", "0.40"))            # calibrado no módulo de PLN (testes/calibrar_rag.py)
VOZ_MEMORIA_TURNOS = int(os.getenv("VOZ_MEMORIA_TURNOS", "6"))
VOZ_AQUECER = os.getenv("VOZ_AQUECER", "1") == "1"                     # carrega os modelos na subida (1º pedido não estoura o tempo do front)

YOLO_MODELO = os.getenv("YOLO_MODELO", "modelos/rdd2022-n-r2.onnx")  # o .json com classes e limiares fica ao lado
YOLO_LIMIAR = float(os.environ["YOLO_LIMIAR"]) if os.getenv("YOLO_LIMIAR") else None  # vazio = limiar do cidadão escolhido no treino

# Reserva multimodal da foto do cidadão: entra quando o YOLO não acha nada (fio, lixo, poste, árvore, alagamento...).
VISAO_RESERVA = os.getenv("VISAO_RESERVA", "off")                    # off | mock | gemini
VISAO_RESERVA_MODELO = os.getenv("VISAO_RESERVA_MODELO", "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash")  # lista: tenta o próximo se um estiver sobrecarregado, lento ou sem cota. O lite vem 1º: no teste de 12/11 respondeu em 1,4 s, o flash travou e o 3.8 estava sobrecarregado
VISAO_RESERVA_CHAVE = os.getenv("VISAO_RESERVA_CHAVE", "") or os.getenv("LLM_API_KEY", "")  # vazio = usa a chave do LLM
VISAO_RESERVA_TIMEOUT = float(os.getenv("VISAO_RESERVA_TIMEOUT", "12"))  # total, somando os modelos da lista
# Limiar por classe só na foto do cidadão (v1.4). D20 (couro de jacaré) confunde com piso de bloquinho/sextavado da calçada.
YOLO_LIMIAR_CLASSE = {k.strip(): float(v) for k, v in (p.split("=") for p in os.getenv("YOLO_LIMIAR_CLASSE", "D20=0.75").split(",") if "=" in p)}
# Calibração da confiança da análise (v1.4): o Gemini se dá nota alta demais; teto geral abaixo de 100%.
LLM_TETO_CONFIANCA = float(os.getenv("LLM_TETO_CONFIANCA", "0.85"))
TETO_CONFIANCA = float(os.getenv("TETO_CONFIANCA", "0.95"))

# Endereço por extenso (v1.1): OpenStreetMap / Nominatim, grátis e sem chave. O User-Agent identifica o projeto (regra do Nominatim).
GEO_URL = os.getenv("GEO_URL", "https://nominatim.openstreetmap.org")
GEO_USER_AGENT = os.getenv("GEO_USER_AGENT", "QuemResolve/1.1 (projeto academico FIAP; github.com/GS-Citizen-Tech/quem-resolve)")
GEO_TIMEOUT = float(os.getenv("GEO_TIMEOUT", "5"))
# Malha dos 96 distritos (v1.3). Vazio = app/data/distritos_sp.geojson, que a API baixa sozinha do IBGE
# na primeira subida (DISTRITOS_BAIXAR=1). Depois disso não depende mais do IBGE.
DISTRITOS_ARQUIVO = os.getenv("DISTRITOS_ARQUIVO", "")
DISTRITOS_BAIXAR = os.getenv("DISTRITOS_BAIXAR", "1").lower() not in ("0", "false", "nao", "não", "off")

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

# Frota pelo console (v1.0): vídeo curto ou fotos enviados pelo gestor e processados em segundo plano na API.
FROTA_PASTA = os.getenv("FROTA_PASTA", "")                              # vazio = pasta temporária do sistema
FROTA_MAX_MB = int(os.getenv("FROTA_MAX_MB", "80"))                     # tamanho máximo do vídeo
FROTA_MAX_SEGUNDOS = float(os.getenv("FROTA_MAX_SEGUNDOS", "60"))       # vídeo mais longo: processa só o começo
FROTA_MAX_FOTOS = int(os.getenv("FROTA_MAX_FOTOS", "60"))
FROTA_FOTOS_POR_S = float(os.getenv("FROTA_FOTOS_POR_S", "2"))          # sequência de fotos: 2 fotos = 1 s no vídeo anotado

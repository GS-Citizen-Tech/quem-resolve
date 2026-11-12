"""Login do gestor: senha conferida com bcrypt (tabela gestores, ou o GESTORES do .env sem banco)
e token assinado com HMAC. Suficiente para a demonstração; em produção, trocar por Supabase Auth."""
import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Header, HTTPException

from app import config
from app.providers import repositorio


# Hash de mentira para conferir quando o usuário não existe: o tempo de resposta não entrega quem existe.
_HASH_VAZIO = bcrypt.hashpw(b"nao-existe", bcrypt.gensalt(rounds=10))


def _assinar(dados: bytes) -> str:
    return hmac.new(config.AUTH_SEGREDO.encode(), dados, hashlib.sha256).hexdigest()


def autenticar(usuario: str, senha: str) -> dict | None:
    g = repositorio.gestor(usuario)
    certo = bcrypt.checkpw(senha.encode(), g["senha_hash"].encode() if g else _HASH_VAZIO)
    if not g or not certo or not g["ativo"]:
        return None
    expira = datetime.now(timezone.utc) + timedelta(hours=config.AUTH_HORAS)
    carga = {"u": usuario, "o": g["orgao_id"], "n": g["nome"], "e": int(expira.timestamp())}
    dados = base64.urlsafe_b64encode(json.dumps(carga).encode())
    return {"token": f"{dados.decode()}.{_assinar(dados)}", "nome": g["nome"], "orgao_id": g["orgao_id"], "expira_em": expira}


def ler_token(token: str) -> dict | None:
    try:
        dados, assinatura = token.split(".", 1)
        if not secrets.compare_digest(_assinar(dados.encode()), assinatura):
            return None
        carga = json.loads(base64.urlsafe_b64decode(dados))
        if carga["e"] < datetime.now(timezone.utc).timestamp():
            return None
        return carga
    except (ValueError, KeyError):
        return None


def exigir_gestor(authorization: str | None = Header(default=None)) -> dict:
    """Dependência FastAPI: rotas que só o gestor logado pode usar."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Faça login para continuar.")
    carga = ler_token(authorization.removeprefix("Bearer "))
    if not carga:
        raise HTTPException(401, "Sua sessão expirou. Faça login de novo.")
    return carga


def exigir_gestor_ou_robo(authorization: str | None = Header(default=None),
                          x_robo_chave: str | None = Header(default=None)) -> dict:
    """Gestor logado ou o robô de RPA (cabeçalho X-Robo-Chave)."""
    if x_robo_chave and config.ROBO_CHAVE and secrets.compare_digest(x_robo_chave, config.ROBO_CHAVE):
        return {"u": "robo-rpa", "o": None, "n": "Robô RPA"}
    return exigir_gestor(authorization)

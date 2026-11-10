"""OuviAí (IoT): transforma a classificação sonora do celular num alerta acessível."""
import uuid
from datetime import datetime, timezone

from app import config
from app.providers import repositorio
from app.schemas.iot import EventoSom, EventoSomEntrada

MENSAGENS = {
    "sirene": "Sirene por perto. Veículo de emergência pode estar passando.",
    "buzina": "Buzina por perto. Atenção ao atravessar.",
    "ambiente": "Som ambiente, nada de importante.",
}


def processar(e: EventoSomEntrada) -> EventoSom:
    alerta = e.classe != "ambiente" and e.confianca >= config.LIMIAR_IOT
    return repositorio.salvar_evento_som(EventoSom(
        **e.model_dump(), id=str(uuid.uuid4()), recebido_em=datetime.now(timezone.utc),
        alerta=alerta, mensagem=MENSAGENS[e.classe],
    ))

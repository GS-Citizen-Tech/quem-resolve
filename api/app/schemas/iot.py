"""Contrato do IoT OuviAí (disciplina 07, Ian): eventos sonoros classificados no celular (Edge Impulse)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ClasseSom = Literal["sirene", "buzina", "ambiente"]


class EventoSomEntrada(BaseModel):
    classe: ClasseSom
    confianca: float = Field(ge=0, le=1)
    dispositivo: str = Field(default="celular-demo", max_length=50)


class EventoSom(EventoSomEntrada):
    id: str
    recebido_em: datetime
    alerta: bool = Field(description="True quando o som é de interesse e passou do limiar: o app vibra/pisca")
    mensagem: str

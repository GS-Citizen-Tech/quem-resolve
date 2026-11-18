"""Memória da conversa: guarda só texto, só em RAM, só durante a sessão."""


class Memoria:
    def __init__(self, max_turnos: int = 6):
        self.max_turnos = max_turnos
        self._mensagens: list[dict] = []

    def adicionar(self, papel: str, texto: str) -> None:
        self._mensagens.append({"role": papel, "content": texto})
        limite = self.max_turnos * 2  # 1 turno = pergunta + resposta
        if len(self._mensagens) > limite:
            self._mensagens = self._mensagens[-limite:]

    def mensagens(self) -> list[dict]:
        return list(self._mensagens)

    def ultima_pergunta(self) -> str:
        for m in reversed(self._mensagens):
            if m["role"] == "user":
                return m["content"]
        return ""

    def limpar(self) -> None:
        self._mensagens.clear()

    def __len__(self) -> int:
        return len(self._mensagens)


# Conversão para o formato de histórico de CONTRATOS.md (seções G e H).
_PAPEL_PARA_ROLE = {"cidadao": "user", "assistente": "assistant"}
_ROLE_PARA_PAPEL = {v: k for k, v in _PAPEL_PARA_ROLE.items()}


def memoria_de_historico(historico: list[dict] | None, max_turnos: int = 6) -> Memoria:
    mem = Memoria(max_turnos)
    for m in historico or []:
        role = _PAPEL_PARA_ROLE.get(m.get("papel"))
        if role and m.get("texto"):
            mem.adicionar(role, m["texto"])
    return mem


def historico_de_memoria(memoria: Memoria) -> list[dict]:
    return [{"papel": _ROLE_PARA_PAPEL[m["role"]], "texto": m["content"]} for m in memoria.mensagens()]

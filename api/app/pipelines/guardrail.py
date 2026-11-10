"""Guardrail de segurança, camada 1 (regras). Roda antes de qualquer roteamento.

Princípio: preferir falso positivo. A camada 2 (classificador LLM, parceiro/GenAI)
entra em `avaliar` depois das regras, só quando elas não dispararem.
"""
from app.pipelines.texto import normalizar
from app.schemas.guardrail import CanalEmergencia, GuardrailResultado

CANAIS = {
    "190": CanalEmergencia(nome="Polícia Militar", numero="190", quando="Crime acontecendo, pessoa em perigo"),
    "192": CanalEmergencia(nome="SAMU", numero="192", quando="Pessoa ferida ou passando mal"),
    "193": CanalEmergencia(nome="Bombeiros", numero="193", quando="Fogo, resgate"),
    "199": CanalEmergencia(nome="Defesa Civil", numero="199", quando="Desabamento, alagamento, risco estrutural"),
    "180": CanalEmergencia(nome="Central de Atendimento à Mulher", numero="180", quando="Violência contra a mulher"),
    "100": CanalEmergencia(nome="Disque Direitos Humanos", numero="100", quando="Violência contra crianças, idosos, PcD"),
}

# (tipo, nível, canal principal, termos). A ordem importa: o primeiro que bater vence.
REGRAS: list[tuple[str, int, str, list[str]]] = [
    ("fogo", 1, "193", ["fogo", "incendio", "pegando fogo", "fumaca preta", "chamas"]),
    ("pessoa_ferida", 1, "192", ["ferido", "ferida", "sangrando", "desmaiou", "atropelad", "inconsciente", "nao respira"]),
    ("crime_em_andamento", 1, "190", ["assalto agora", "estao assaltando", "arma", "tiroteio", "tiro", "sequestro", "me seguindo"]),
    ("gas", 1, "193", ["cheiro de gas", "vazamento de gas", "cheiro forte de gas"]),
    ("desabamento", 1, "199", ["desabou", "desabando", "desmoronou", "soterrad"]),
    ("violencia_domestica", 2, "180", ["meu marido me bate", "me bateu", "violencia domestica", "apanho", "me agride", "agressao em casa"]),
    ("violacao_direitos", 2, "100", ["maus tratos", "crianca abandonada", "idoso abandonado", "abuso"]),
    ("violencia_passada", 2, "190", ["fui assaltad", "me roubaram", "fui agredid", "furtaram meu"]),
    ("fio_faiscando", 3, "193", ["faisca", "faiscando", "fio de alta caido", "fio energizado"]),
    ("arvore_risco", 3, "199", ["arvore caindo", "arvore prestes", "galho vai cair", "arvore vai cair"]),
    ("alagamento_risco", 3, "199", ["agua subindo", "alagando casa", "enchente"]),
]


def avaliar(texto: str) -> GuardrailResultado:
    t = normalizar(texto)
    for tipo, nivel, canal, termos in REGRAS:
        termo = next((x for x in termos if x in t), None)
        if termo:
            principal = CANAIS[canal]
            outros = [c for k, c in CANAIS.items() if k != canal and (nivel == 1 or k in ("190", "180", "100"))]
            return GuardrailResultado(
                nivel=nivel,
                tipo=tipo,
                camada="regras",
                justificativa=f"Termo de risco encontrado: '{termo}'",
                canal_principal=principal,
                outros_canais=outros,
                pode_continuar=nivel == 3,
                saida_rapida=tipo == "violencia_domestica",
            )
    return GuardrailResultado(nivel=0, pode_continuar=True)

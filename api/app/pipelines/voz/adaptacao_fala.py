"""Adaptação do texto para fala, aplicada antes do TTS.

- remove markdown, links e emojis;
- telefones e números de serviço são lidos dígito a dígito ("um nove dois");
- siglas viram a forma falada ("CET" -> "cê é tê");
- datas, horas, valores, porcentagens e demais números viram palavras;
- frases longas são quebradas e a resposta é limitada a poucas frases.
"""
import re

try:
    from num2words import num2words
except ImportError:  # fallback mínimo
    num2words = None

DIGITOS = {"0": "zero", "1": "um", "2": "dois", "3": "três", "4": "quatro",
           "5": "cinco", "6": "meia", "7": "sete", "8": "oito", "9": "nove"}

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]

# Números curtos de serviço público: lidos como as pessoas falam.
NUMEROS_SERVICO = {"190": "um nove zero", "192": "um nove dois", "193": "um nove três",
                   "199": "um nove nove", "156": "um cinco meia", "180": "um oito zero",
                   "100": "cem", "136": "um três meia", "188": "um oito oito"}

SIGLAS = {
    "SP156": "ésse pê cento e cinquenta e seis",
    "CET": "cê é tê", "SAMU": "samu", "PM": "Polícia Militar", "GCM": "Guarda Civil Metropolitana",
    "UBS": "u bê ésse", "CPF": "cê pê éfe", "RG": "érre gê", "LGPD": "éle gê pê dê",
    "km": "quilômetros", "nº": "número",
}

# Marcadores internos: um telefone falado fica entre INI e FIM e nunca é quebrado ao meio.
INI, FIM, VIRG = "\x01", "\x02", "\x03"

EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\u200d\ufe0f]+")


def _extenso(n: str) -> str:
    if num2words is None:
        return n
    try:
        return num2words(int(n), lang="pt_BR")
    except (ValueError, OverflowError):
        return n


def _digito_a_digito(numero: str) -> str:
    return " ".join(DIGITOS[d] for d in numero if d.isdigit())


def remover_markdown(texto: str) -> str:
    texto = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", texto)            # [texto](link)
    url = r"(?:https?://|www\.)\S+?|\b[\w-]+(?:\.[\w-]+)*\.(?:gov\.br|com\.br|org\.br|com|br)\b(?:/\S*?)?"
    fim = r"(?=[.,;!?)]?(?:\s|$))"
    texto = re.sub(rf"\b(no|pelo|o|ou|e|do) site(?: oficial)?\s+(?:{url}){fim}", r"\1 site oficial", texto)
    texto = re.sub(rf"(?:{url}){fim}", "o site oficial", texto)          # URLs soltas
    texto = re.sub(r"[*_`#>|]+", "", texto)                              # ênfase, títulos, tabelas
    texto = re.sub(r"^\s*(?:[-•]|\d+[.)])\s+", "", texto, flags=re.M)    # marcadores de lista
    return texto


def _telefones(texto: str) -> str:
    # 0800 72 72 196 / 0800 727 2196 / 0800-055-0195
    def tel0800(m):
        grupos = [g for g in re.split(r"[\s.-]+", m.group(1).strip()) if g]
        return INI + "zero oitocentos, " + ", ".join(_digito_a_digito(g) for g in grupos) + FIM
    texto = re.sub(r"\b0800((?:[\s.-]*\d{2,4}){2,3})\b", tel0800, texto)
    # (11) 3388-8000 / 11 3388 8000
    texto = re.sub(r"\(?\b(\d{2})\)?\s(\d{4,5})[\s-](\d{4})\b",
                   lambda m: INI + ", ".join(_digito_a_digito(g) for g in m.groups()) + FIM, texto)
    return texto


def _datas_horas(texto: str) -> str:
    def data(m):
        d, mes, ano = int(m.group(1)), int(m.group(2)), m.group(3)
        if not 1 <= mes <= 12:
            return m.group(0)
        dia = "primeiro" if d == 1 else _extenso(str(d))
        s = f"{dia} de {MESES[mes - 1]}"
        if ano:
            ano = ano if len(ano) == 4 else "20" + ano
            s += f" de {_extenso(ano)}"
        return s
    texto = re.sub(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", data, texto)

    def hora(m):
        h, mi = m.group(1), m.group(2)
        s = f"{_extenso(h)} {'hora' if int(h) == 1 else 'horas'}"
        if mi and int(mi):
            s += f" e {_extenso(mi)}"
        return s
    texto = re.sub(r"\b(\d{1,2})\s?h(?:(\d{2})(?:min)?)?\b", hora, texto)
    return texto


def _numeros(texto: str) -> str:
    # Lei 13.709/2018 -> "Lei treze mil setecentos e nove, de dois mil e dezoito"
    texto = re.sub(r"\b(\d{1,3}(?:\.\d{3})+|\d+)/(\d{4})\b",
                   lambda m: f"{_extenso(m.group(1).replace('.', ''))}, de {_extenso(m.group(2))}", texto)
    texto = re.sub(r"R\$\s?(\d+)(?:,(\d{2}))?",
                   lambda m: f"{_extenso(m.group(1))} reais" + (f" e {_extenso(m.group(2))} centavos" if m.group(2) and int(m.group(2)) else ""),
                   texto)
    texto = re.sub(r"(\d+)\s?%", lambda m: f"{_extenso(m.group(1))} por cento", texto)
    texto = re.sub(r"\b(\d+)[ºª]", lambda m: num2words(int(m.group(1)), lang="pt_BR", to="ordinal") if num2words else m.group(0), texto)
    texto = re.sub(r"\b(\d+),(\d+)\b", lambda m: f"{_extenso(m.group(1))} vírgula {_extenso(m.group(2))}", texto)
    texto = re.sub(r"\b\d{3}\b", lambda m: NUMEROS_SERVICO.get(m.group(0), m.group(0)), texto)
    texto = re.sub(r"\b(\d{1,3}(?:\.\d{3})+)\b", lambda m: _extenso(m.group(1).replace(".", "")), texto)
    texto = re.sub(r"\b\d+\b", lambda m: _extenso(m.group(0)), texto)
    return texto


def _sigla_sp(texto: str) -> str:
    """"SP" vira "São Paulo" só quando é o nome do lugar ("em SP", "de SP", "Osasco-SP").
    Em nomes de órgãos ("SP Regula", "SPTrans") é lido como sigla."""
    texto = re.sub(r"\b(de|em|da|na|-)\s?SP\b(?!\s?[A-Z])", lambda m: f"{m.group(1)} São Paulo".replace("- ", "-"), texto)
    return re.sub(r"\bSP(?=\s?[A-Z]|\b)", "ésse pê", texto)


def _siglas(texto: str) -> str:
    texto = texto.replace("SP156", "\x00")  # protege o SP156, que tem pronúncia própria
    texto = _sigla_sp(texto).replace("\x00", "SP156")
    for sigla, falada in sorted(SIGLAS.items(), key=lambda x: -len(x[0])):
        texto = re.sub(rf"(?<![\w]){re.escape(sigla)}(?![\w])", falada, texto)
    return texto


def _maiuscula_inicial(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


def _frases_curtas(texto: str, max_frases: int, max_palavras: int = 25) -> str:
    # vírgulas dentro de telefones viram VIRG para não serem usadas como ponto de quebra
    texto = re.sub(f"{INI}(.*?){FIM}", lambda m: m.group(1).replace(",", VIRG), texto)
    frases = [f.strip() for f in re.split(r"(?<=[.!?])\s+", texto) if f.strip()]
    saida = []
    for f in frases:
        if len(f.split()) > max_palavras and "," in f:
            partes = [p.strip() for p in f.split(",") if p.strip()]
            meio = len(partes) // 2
            f = ", ".join(partes[:meio]).rstrip(".") + ". " + _maiuscula_inicial(", ".join(partes[meio:]))
        saida.append(f)
    return " ".join(saida[:max_frases]).replace(VIRG, ",")


def adaptar_para_fala(texto: str, max_frases: int = 5) -> str:
    texto = remover_markdown(texto)
    texto = EMOJI.sub("", texto)
    texto = _telefones(texto)
    texto = _datas_horas(texto)
    texto = _siglas(texto)
    texto = _numeros(texto)
    texto = re.sub(r"(?<=\w)/(?=\w)", " ou ", texto)  # e/ou, sim/não
    texto = texto.replace("\n", ". ")
    texto = re.sub(r"\s*([.,!?])(\s*[.,])+", r"\1", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    texto = _frases_curtas(texto, max_frases).replace(INI, "").replace(FIM, "")
    if texto and texto[-1] not in ".!?":
        texto += "."
    return texto

import unicodedata


def normalizar(texto: str) -> str:
    """Minúsculas e sem acento, para as regras pegarem 'faísca' e 'faisca'."""
    t = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in t if not unicodedata.combining(c))

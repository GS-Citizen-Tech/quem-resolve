"""Fotos (Storage). Sem SUPABASE_URL: memória (o link é um data: URL). Com SUPABASE_URL + SUPABASE_CHAVE_SECRETA:
bucket PRIVADO no Supabase Storage, e o gestor recebe links que valem por pouco tempo (decisão 3 do PLANO-BANCO).

O banco guarda só o caminho (ex.: "cidadao/<uuid>.jpg"). Valores antigos que já são URL (http/data:) passam direto.
A chave secreta fica só na API (.env): nunca no front, nunca no Git."""
import base64
import binascii
import io
import logging
import uuid

import httpx

from app import config

log = logging.getLogger("quem-resolve")
LADO_MAX = 1280
MAX_BYTES = 8 * 1024 * 1024


class ErroFoto(ValueError):
    """Foto inválida (formato, tamanho ou base64)."""


class ErroArmazenamento(RuntimeError):
    """Storage fora do ar ou recusou o pedido."""


# ---------- Preparar a foto do cidadão ----------

def decodificar(b64: str) -> bytes:
    """Aceita base64 puro ou data URL (data:image/jpeg;base64,...)."""
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[-1]
    try:
        dados = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise ErroFoto("A foto não chegou inteira. Tente de novo.")
    if len(dados) > MAX_BYTES:
        raise ErroFoto("A foto passa de 8 MB.")
    return dados


def preparar_foto(dados: bytes) -> bytes:
    """Reduz (lado maior 1280 px), tira EXIF (GPS da câmera) e borra rostos, pessoas e placas ANTES de guardar (RF10)."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    from app.providers.privacidade import borrar_pil
    try:
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(dados))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ErroFoto("Não consegui ler a foto.")
    im.thumbnail((LADO_MAX, LADO_MAX))
    im, _ = borrar_pil(im)
    saida = io.BytesIO()
    im.save(saida, "JPEG", quality=80, optimize=True)  # salvar de novo descarta o EXIF
    return saida.getvalue()


# ---------- Implementações ----------

class Memoria:
    nome = "memoria"

    def __init__(self):
        self.arquivos: dict[str, bytes] = {}

    def preparar(self) -> None:
        pass

    def salvar(self, caminho: str, dados: bytes) -> None:
        self.arquivos[caminho] = dados

    def links(self, caminhos: list[str], segundos: int) -> dict[str, str]:
        return {c: "data:image/jpeg;base64," + base64.b64encode(self.arquivos[c]).decode()
                for c in caminhos if c in self.arquivos}

    def apagar(self, caminhos: list[str]) -> None:
        for c in caminhos:
            self.arquivos.pop(c, None)


class Supabase:
    nome = "supabase"

    def __init__(self, url: str, chave: str, bucket: str, cliente: httpx.Client | None = None):
        self.base = url.rstrip("/") + "/storage/v1"
        self.bucket = bucket
        cab = {"apikey": chave}
        if not chave.startswith("sb_"):  # chave antiga (JWT service_role) também vai no Authorization
            cab["Authorization"] = f"Bearer {chave}"
        self.http = cliente or httpx.Client(headers=cab, timeout=15)
        self.http.headers.update(cab)

    def _ok(self, r: httpx.Response, o_que: str) -> httpx.Response:
        if r.status_code >= 300:
            raise ErroArmazenamento(f"Storage recusou ({o_que}): {r.status_code}")
        return r

    def preparar(self) -> None:
        """Cria o bucket privado na primeira subida (se já existe, o Supabase responde erro e seguimos)."""
        try:
            r = self.http.post(f"{self.base}/bucket", json={"id": self.bucket, "name": self.bucket, "public": False,
                                                             "file_size_limit": MAX_BYTES, "allowed_mime_types": ["image/jpeg"]})
            if r.status_code < 300:
                log.info("Bucket privado '%s' criado no Storage.", self.bucket)
        except httpx.HTTPError as e:
            log.warning("Não consegui falar com o Storage na subida: %s", e.__class__.__name__)

    def salvar(self, caminho: str, dados: bytes) -> None:
        try:
            self._ok(self.http.post(f"{self.base}/object/{self.bucket}/{caminho}", content=dados,
                                    headers={"Content-Type": "image/jpeg", "x-upsert": "true"}), "salvar")
        except httpx.HTTPError as e:
            raise ErroArmazenamento(str(e.__class__.__name__))

    def links(self, caminhos: list[str], segundos: int) -> dict[str, str]:
        if not caminhos:
            return {}
        try:
            r = self._ok(self.http.post(f"{self.base}/object/sign/{self.bucket}",
                                        json={"expiresIn": segundos, "paths": caminhos}), "assinar")
        except httpx.HTTPError as e:
            raise ErroArmazenamento(str(e.__class__.__name__))
        return {x["path"]: self.base + x["signedURL"] for x in r.json() if x.get("signedURL") and not x.get("error")}

    def apagar(self, caminhos: list[str]) -> None:
        if caminhos:
            try:
                self._ok(self.http.request("DELETE", f"{self.base}/object/{self.bucket}", json={"prefixes": caminhos}), "apagar")
            except httpx.HTTPError as e:
                raise ErroArmazenamento(str(e.__class__.__name__))


def _escolher():
    if config.SUPABASE_URL and config.SUPABASE_CHAVE_SECRETA:
        return Supabase(config.SUPABASE_URL, config.SUPABASE_CHAVE_SECRETA, config.STORAGE_BUCKET)
    return Memoria()


atual = _escolher()


# ---------- Usado pelos routers e pipelines ----------

def _e_caminho(v: str | None) -> bool:
    return bool(v) and not v.startswith(("http://", "https://", "data:"))


def guardar(pasta: str, dados: bytes) -> str:
    caminho = f"{pasta}/{uuid.uuid4()}.jpg"
    atual.salvar(caminho, dados)
    return caminho


def guardar_data_url(pasta: str, valor: str | None) -> str | None:
    """Recorte da frota chega como data URL (já borrado no processar_video.py): vai para o Storage.
    URL http fica como está. Se o Storage falhar, a detecção segue sem recorte."""
    if not valor or not valor.startswith("data:image"):
        return valor
    try:
        return guardar(pasta, decodificar(valor))
    except (ErroFoto, ErroArmazenamento) as e:
        log.warning("Recorte não guardado: %s", e)
        return None


def com_links(itens: list, segundos: int | None = None) -> list:
    """Troca o caminho de foto_url por um link temporário (um pedido só ao Storage para a lista toda).
    Se o Storage falhar, a lista sai sem foto em vez de dar erro."""
    caminhos = [o.foto_url for o in itens if _e_caminho(o.foto_url)]
    try:
        links = atual.links(caminhos, segundos or config.LINK_FOTO_MINUTOS * 60) if caminhos else {}
    except ErroArmazenamento as e:
        log.warning("Links de foto indisponíveis: %s", e)
        links = {}
    return [o.model_copy(update={"foto_url": links.get(o.foto_url)}) if _e_caminho(o.foto_url) else o for o in itens]


def apagar(caminhos: list[str | None]) -> None:
    atual.apagar([c for c in caminhos if _e_caminho(c)])

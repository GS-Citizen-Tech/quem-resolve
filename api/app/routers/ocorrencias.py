import logging

from fastapi import APIRouter, Depends, HTTPException

from app.pipelines import metricas, ocorrencias
from app.providers import armazenamento, repositorio
from app.providers import base_conhecimento as base
from app.providers.auth import exigir_gestor, exigir_gestor_ou_robo
from app.schemas.metricas import Metricas
from app.schemas.ocorrencia import AtualizarStatus, HistoricoItem, Ocorrencia, OcorrenciaCriar

router = APIRouter(prefix="/ocorrencias", tags=["ocorrências"])
log = logging.getLogger("quem-resolve")


@router.post("", response_model=Ocorrencia, status_code=201)
def criar(dados: OcorrenciaCriar):
    """Cidadão confirmou (ou corrigiu) a categoria: human-in-the-loop.
    A foto (v0.9) é borrada e guardada no Storage privado; se o Storage falhar, o reporte vai sem foto."""
    foto = None
    if dados.foto_base64:
        try:
            foto = armazenamento.guardar("cidadao", armazenamento.preparar_foto(armazenamento.decodificar(dados.foto_base64)))
        except armazenamento.ErroFoto as e:
            raise HTTPException(422, str(e))
        except armazenamento.ErroArmazenamento as e:
            log.warning("Foto do cidadão não guardada: %s", e)
    dados = dados.model_copy(update={"foto_base64": None, "foto_url": foto})  # foto_url do cliente nunca é aceita
    try:
        o = ocorrencias.registrar(dados)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return _publica(o)


def _publica(o: Ocorrencia) -> Ocorrencia:
    """O que sai sem login: sem foto (v0.9)."""
    return o.model_copy(update={"foto_url": None})


@router.get("", response_model=list[Ocorrencia])
def listar(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
           status: str | None = None, limite: int = 500, _: dict = Depends(exigir_gestor_ou_robo)):
    """Console da gestão e RPA (o robô de e-mail busca status=pendente_envio). Exige login (v0.8).
    foto_url vem como link temporário do Storage privado (v0.9)."""
    return armazenamento.com_links(ocorrencias.filtrar(categoria, responsavel, origem, status, limite=min(limite, 2000)))


@router.get("/metricas", response_model=Metricas)
def obter_metricas(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
                   _: dict = Depends(exigir_gestor)):
    return metricas.calcular(ocorrencias.filtrar(categoria, responsavel, origem))


@router.get("/{oid}", response_model=Ocorrencia)
def obter(oid: str):
    """Uma ocorrência pelo id: "Meus reportes" do cidadão consulta o status atual (v0.5). Sem foto (v0.9)."""
    o = repositorio.ocorrencia(oid)
    if not o:
        raise HTTPException(404, "Ocorrência não encontrada.")
    return _publica(o)


def _nome_de(quem: str) -> str:
    if quem == "robo-rpa":
        return "Robô RPA"
    if quem.startswith("onibus:"):
        return f"Ônibus linha {quem.removeprefix('onibus:')}"
    g = repositorio.gestor(quem)
    return g["nome"] if g else quem


@router.get("/{oid}/historico", response_model=list[HistoricoItem])
def historico(oid: str, _: dict = Depends(exigir_gestor)):
    """v0.9: quem mudou o status ou a categoria, quando e com qual observação (mais antigo primeiro)."""
    if not repositorio.ocorrencia(oid):
        raise HTTPException(404, "Ocorrência não encontrada.")
    nomes: dict[str, str] = {}
    return [HistoricoItem(**{**h, "quem": nomes.setdefault(h["quem"], _nome_de(h["quem"]))}) for h in repositorio.historico(oid)]


@router.patch("/{oid}/status", response_model=Ocorrencia)
def atualizar_status(oid: str, dados: AtualizarStatus, quem: dict = Depends(exigir_gestor_ou_robo)):
    """Gestor muda status ou reclassifica (HITL do gestor); o robô de RPA marca como enviada.
    Cada mudança vai para o histórico (v0.9), com a observação."""
    o = repositorio.ocorrencia(oid)
    if not o:
        raise HTTPException(404, "Ocorrência não encontrada.")
    if quem["u"] != "robo-rpa" and quem.get("o") != o.responsavel_id:
        raise HTTPException(403, "Esta ocorrência é de outro órgão. Você pode ver, mas não alterar.")
    mudou: list[tuple[str, str, str]] = []
    if dados.categoria_final is not None:
        if quem["u"] == "robo-rpa":
            raise HTTPException(403, "O robô não pode reclassificar.")
        cat = base.categoria(dados.categoria_final)
        if not cat:
            raise HTTPException(422, "Categoria desconhecida.")
        if cat.id != o.categoria_final:
            mudou.append(("categoria", o.categoria_final, cat.id))
            o.categoria_final, o.responsavel_id, o.corrigida_pelo_gestor = cat.id, cat.responsavel_id, True
    if dados.status is not None and dados.status != o.status:
        mudou.append(("status", o.status, dados.status))
        o.status = dados.status
    if mudou:
        repositorio.salvar_ocorrencia(o)
        for campo, de, para in mudou:
            repositorio.registrar_historico(o.id, quem["u"], campo, de, para, dados.observacao)
    return armazenamento.com_links([o])[0]

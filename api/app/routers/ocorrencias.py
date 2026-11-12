from fastapi import APIRouter, Depends, HTTPException

from app.pipelines import metricas, ocorrencias
from app.providers import base_conhecimento as base
from app.providers import repositorio
from app.providers.auth import exigir_gestor, exigir_gestor_ou_robo
from app.schemas.metricas import Metricas
from app.schemas.ocorrencia import AtualizarStatus, Ocorrencia, OcorrenciaCriar

router = APIRouter(prefix="/ocorrencias", tags=["ocorrências"])


@router.post("", response_model=Ocorrencia, status_code=201)
def criar(dados: OcorrenciaCriar):
    """Cidadão confirmou (ou corrigiu) a categoria: human-in-the-loop."""
    try:
        return ocorrencias.registrar(dados)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("", response_model=list[Ocorrencia])
def listar(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
           status: str | None = None, limite: int = 500, _: dict = Depends(exigir_gestor_ou_robo)):
    """Console da gestão e RPA (o robô de e-mail busca status=pendente_envio). Exige login (v0.8)."""
    return ocorrencias.filtrar(categoria, responsavel, origem, status)[:limite]


@router.get("/metricas", response_model=Metricas)
def obter_metricas(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
                   _: dict = Depends(exigir_gestor)):
    return metricas.calcular(ocorrencias.filtrar(categoria, responsavel, origem))


@router.get("/{oid}", response_model=Ocorrencia)
def obter(oid: str):
    """Uma ocorrência pelo id: "Meus reportes" do cidadão consulta o status atual (contratos v0.4)."""
    o = repositorio.ocorrencia(oid)
    if not o:
        raise HTTPException(404, "Ocorrência não encontrada.")
    return o


@router.patch("/{oid}/status", response_model=Ocorrencia)
def atualizar_status(oid: str, dados: AtualizarStatus, quem: dict = Depends(exigir_gestor_ou_robo)):
    """Gestor muda status ou reclassifica (HITL do gestor); o robô de RPA marca como enviada."""
    o = repositorio.ocorrencia(oid)
    if not o:
        raise HTTPException(404, "Ocorrência não encontrada.")
    if quem["u"] != "robo-rpa" and quem.get("o") != o.responsavel_id:
        raise HTTPException(403, "Esta ocorrência é de outro órgão. Você pode ver, mas não alterar.")
    if dados.categoria_final is not None:
        if quem["u"] == "robo-rpa":
            raise HTTPException(403, "O robô não pode reclassificar.")
        cat = base.categoria(dados.categoria_final)
        if not cat:
            raise HTTPException(422, "Categoria desconhecida.")
        if cat.id != o.categoria_final:
            o.categoria_final, o.responsavel_id, o.corrigida_pelo_gestor = cat.id, cat.responsavel_id, True
    if dados.status is not None:
        o.status = dados.status
    return o

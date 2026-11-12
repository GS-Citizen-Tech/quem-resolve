"""Armazenamento no Postgres (Supabase na nuvem, ou um Postgres local). Ligado quando há DATABASE_URL.
SQL escrito à mão com SQLAlchemy Core; o esquema está em app/db/migracoes/ (ver PLANO-BANCO.md)."""
import json
import uuid
from datetime import date, datetime, timezone

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app import config
from app.db import migrar
from app.providers import base_conhecimento as base
from app.schemas.iot import EventoSom
from app.schemas.ocorrencia import Ocorrencia

NOME = "postgres"
_motor: Engine | None = None


def motor() -> Engine:
    global _motor
    if _motor is None:
        url = config.DATABASE_URL
        for prefixo in ("postgresql://", "postgres://"):
            if url.startswith(prefixo):
                url = "postgresql+psycopg://" + url[len(prefixo):]
        # prepare_threshold=None: o pooler do Supabase (modo transação) não aceita prepared statements.
        _motor = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_recycle=300,
                               connect_args={"prepare_threshold": None, "connect_timeout": 10})
    return _motor


def _uuid_ok(v: str | None) -> bool:
    try:
        uuid.UUID(str(v))
        return True
    except ValueError:
        return False


def _utc(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat()


# ---------- Ciclo de vida ----------

def preparar() -> None:
    """Na subida da API: aplica as migrações, copia a base do JSON e cria os gestores do .env que ainda não existem."""
    with motor().begin() as c:
        migrar.aplicar(c)
    sincronizar_base()
    semear_gestores()


def sincronizar_base() -> None:
    """O JSON versionado (RF32) continua sendo a fonte; o banco recebe uma cópia para as consultas SQL e as visões."""
    with motor().begin() as c:
        for r in base.responsaveis().values():
            c.execute(text("""insert into responsaveis (id, nome, canal, contato, url) values (:id, :nome, :canal, :contato, :url)
                              on conflict (id) do update set nome = excluded.nome, canal = excluded.canal,
                              contato = excluded.contato, url = excluded.url"""), r.model_dump())
        for k in base.categorias().values():
            c.execute(text("""insert into categorias (id, nome, responsavel_id, emergencia, classes_visao)
                              values (:id, :nome, :responsavel_id, :emergencia, :classes_visao)
                              on conflict (id) do update set nome = excluded.nome, responsavel_id = excluded.responsavel_id,
                              emergencia = excluded.emergencia, classes_visao = excluded.classes_visao"""),
                      k.model_dump(include={"id", "nome", "responsavel_id", "emergencia", "classes_visao"}))


def semear_gestores() -> None:
    """Só cria quem não existe: depois da 1ª subida, trocar a senha no .env não muda o banco (de propósito)."""
    with motor().begin() as c:
        for item in config.GESTORES:
            partes = item.split(":")
            if len(partes) != 4:
                continue
            usuario, senha, orgao, nome = partes
            existe = c.execute(text("select 1 from gestores where usuario = :u"), {"u": usuario}).first()
            if not existe:
                c.execute(text("insert into gestores (usuario, nome, orgao_id, senha_hash) values (:u, :n, :o, :h)"),
                          {"u": usuario, "n": nome, "o": orgao, "h": bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()})


def saude() -> str:
    try:
        with motor().connect() as c:
            c.execute(text("select 1"))
        return "ok"
    except Exception:  # noqa: BLE001 - qualquer falha de conexão vira "fora do ar" no /health
        return "fora do ar"


def marcar_simuladas() -> None:
    """Chamado logo depois da semente: tudo o que existe é dado de exemplo da demonstração (RF34)."""
    with motor().begin() as c:
        c.execute(text("update ocorrencias set simulada = true"))
        c.execute(text("update passagens_frota set simulada = true"))


def limpar() -> None:
    """Só para os testes: apaga os dados de negócio (a base e os gestores ficam)."""
    with motor().begin() as c:
        c.execute(text("""truncate ocorrencias, historico_ocorrencia, passagens_frota, deteccoes_frota, eventos_som,
                          feedbacks, guardrail_registros, visao_chamadas, voz_latencias"""))


# ---------- Ocorrências ----------

_COLUNAS = """id::text, protocolo, criada_em, descricao, lat, lon, categoria_sugerida, confianca, categoria_final,
              responsavel_id, corrigida_pelo_cidadao, corrigida_pelo_gestor, status, prioridade, origem,
              grupo_duplicata_id::text, foto_path as foto_url"""


def _ocorrencia(linha) -> Ocorrencia:
    return Ocorrencia(**linha._mapping)


def salvar_ocorrencia(o: Ocorrencia) -> Ocorrencia:
    with motor().begin() as c:
        c.execute(text("""
            insert into ocorrencias (id, protocolo, criada_em, descricao, lat, lon, categoria_sugerida, confianca,
                categoria_final, responsavel_id, corrigida_pelo_cidadao, corrigida_pelo_gestor, status, prioridade,
                origem, grupo_duplicata_id, foto_path)
            values (:id, :protocolo, :criada_em, :descricao, :lat, :lon, :categoria_sugerida, :confianca,
                :categoria_final, :responsavel_id, :corrigida_pelo_cidadao, :corrigida_pelo_gestor, :status, :prioridade,
                :origem, :grupo_duplicata_id, :foto_url)
            on conflict (id) do update set
                categoria_final = excluded.categoria_final, responsavel_id = excluded.responsavel_id,
                corrigida_pelo_gestor = excluded.corrigida_pelo_gestor, status = excluded.status,
                prioridade = excluded.prioridade, origem = excluded.origem,
                grupo_duplicata_id = excluded.grupo_duplicata_id, foto_path = excluded.foto_path, atualizada_em = now()
        """), o.model_dump())
    return o


def ocorrencia(oid: str) -> Ocorrencia | None:
    if not _uuid_ok(oid):
        return None
    with motor().connect() as c:
        linha = c.execute(text(f"select {_COLUNAS} from ocorrencias where id = :id"), {"id": oid}).first()
    return _ocorrencia(linha) if linha else None


def ocorrencias(categoria: str | None = None, responsavel: str | None = None, origem: str | None = None,
                status: str | None = None, grupo: str | None = None, limite: int | None = None) -> list[Ocorrencia]:
    filtros = {"categoria_final": categoria, "responsavel_id": responsavel, "origem": origem, "status": status,
               "grupo_duplicata_id": grupo}
    if grupo and not _uuid_ok(grupo):
        return []
    onde = " and ".join(f"{col} = :{col}" for col, v in filtros.items() if v) or "true"
    params = {col: v for col, v in filtros.items() if v}
    sql = f"select {_COLUNAS} from ocorrencias where {onde} order by criada_em desc"
    if limite is not None:
        sql += " limit :limite"
        params["limite"] = limite
    with motor().connect() as c:
        return [_ocorrencia(x) for x in c.execute(text(sql), params)]


def registrar_historico(oid: str, quem: str, campo: str, de: str | None, para: str | None,
                        observacao: str | None = None) -> None:
    with motor().begin() as c:
        c.execute(text("""insert into historico_ocorrencia (ocorrencia_id, quem, campo, de, para, observacao)
                          values (:oid, :quem, :campo, :de, :para, :obs)"""),
                  {"oid": oid, "quem": quem, "campo": campo, "de": de, "para": para, "obs": observacao})


def historico(oid: str) -> list[dict]:
    if not _uuid_ok(oid):
        return []
    with motor().connect() as c:
        return [dict(x._mapping) for x in c.execute(text(
            "select em, quem, campo, de, para, observacao from historico_ocorrencia where ocorrencia_id = :oid order by em, id"),
            {"oid": oid})]


# ---------- Frota ----------

def salvar_passagem(pid: str, dados: dict, deteccoes: list[dict] | None = None) -> None:
    with motor().begin() as c:
        c.execute(text("""insert into passagens_frota (id, linha_onibus, inicio, fim, trajeto, deteccoes, fps, possivelmente_resolvidas)
                          values (:id, :linha_onibus, :inicio, :fim, cast(:trajeto as jsonb), :deteccoes, :fps, :possivelmente_resolvidas)"""),
                  {**dados, "id": pid, "trajeto": json.dumps(dados["trajeto"])})
        for d in deteccoes or []:
            c.execute(text("""insert into deteccoes_frota (passagem_id, detectada_em, lat, lon, classe, categoria_id, confianca,
                                  bbox, recorte_path, ocorrencia_id)
                              values (:pid, :detectada_em, :lat, :lon, :classe, :categoria_id, :confianca,
                                  cast(:bbox as jsonb), :recorte_url, :ocorrencia_id)"""),
                      {**d, "pid": pid, "bbox": json.dumps(d.get("bbox")) if d.get("bbox") else None})


def passagens() -> dict[str, dict]:
    with motor().connect() as c:
        linhas = c.execute(text("""select id::text, linha_onibus, inicio, fim, trajeto, deteccoes, fps, possivelmente_resolvidas
                                   from passagens_frota order by recebida_em""")).all()
    return {x.id: {"linha_onibus": x.linha_onibus, "inicio": _utc(x.inicio), "fim": _utc(x.fim), "trajeto": x.trajeto,
                   "deteccoes": x.deteccoes, "fps": x.fps, "possivelmente_resolvidas": x.possivelmente_resolvidas}
            for x in linhas}


def deteccoes(passagem_id: str) -> list[dict]:
    if not _uuid_ok(passagem_id):
        return []
    with motor().connect() as c:
        return [dict(x._mapping) for x in c.execute(text(
            """select detectada_em, lat, lon, classe, categoria_id, confianca, bbox, recorte_path as recorte_url, ocorrencia_id::text
               from deteccoes_frota where passagem_id = :p order by detectada_em"""), {"p": passagem_id})]


# ---------- IoT ----------

def salvar_evento_som(e: EventoSom) -> EventoSom:
    with motor().begin() as c:
        c.execute(text("""insert into eventos_som (id, classe, confianca, dispositivo, recebido_em, alerta, mensagem)
                          values (:id, :classe, :confianca, :dispositivo, :recebido_em, :alerta, :mensagem)"""), e.model_dump())
    return e


def eventos_som(limite: int = 200) -> list[EventoSom]:
    with motor().connect() as c:
        return [EventoSom(**x._mapping) for x in c.execute(text(
            """select id::text, classe, confianca, dispositivo, recebido_em, alerta, mensagem
               from eventos_som order by recebido_em desc limit :n"""), {"n": limite})]


# ---------- Medições anônimas ----------

def registrar_guardrail(nivel: int, tipo: str | None, camada: str | None, nao_e_emergencia: bool = False) -> None:
    with motor().begin() as c:
        c.execute(text("""insert into guardrail_registros (data, nivel, tipo, camada, nao_e_emergencia, total)
                          values (:d, :n, :t, :c, :ne, 1)
                          on conflict (data, nivel, tipo, camada, nao_e_emergencia)
                          do update set total = guardrail_registros.total + 1"""),
                  {"d": date.today(), "n": nivel, "t": tipo or "", "c": camada or "", "ne": nao_e_emergencia})


def registros_guardrail() -> list[dict]:
    with motor().connect() as c:
        linhas = c.execute(text("select data, nivel, tipo, camada, nao_e_emergencia, total from guardrail_registros order by data, nivel")).all()
    return [{"data": x.data.isoformat(), "nivel": x.nivel, "tipo": x.tipo or None, "camada": x.camada or None,
             "nao_e_emergencia": x.nao_e_emergencia, "total": x.total} for x in linhas]


def salvar_feedback(f: dict) -> dict:
    with motor().begin() as c:
        c.execute(text("""insert into feedbacks (id, recebido_em, alvo, alvo_id, util, comentario)
                          values (:id, :recebido_em, :alvo, :alvo_id, :util, :comentario)"""), f)
    return f


def feedbacks() -> list[dict]:
    with motor().connect() as c:
        return [dict(x._mapping) for x in c.execute(text(
            "select id::text, recebido_em, alvo, alvo_id, util, comentario from feedbacks order by recebido_em"))]


def registrar_visao(latencia_ms: float, origem: str) -> None:
    with motor().begin() as c:
        c.execute(text("insert into visao_chamadas (latencia_ms, origem) values (:l, :o)"), {"l": latencia_ms, "o": origem})


def chamadas_visao() -> list[tuple[float, str]]:
    with motor().connect() as c:
        return [(x.latencia_ms, x.origem) for x in c.execute(text(
            "select latencia_ms, origem from visao_chamadas order by id desc limit 1000"))]


def registrar_voz(stt_ms: float, llm_ms: float, tts_ms: float, total_ms: float, provedor: str) -> None:
    with motor().begin() as c:
        c.execute(text("""insert into voz_latencias (stt_ms, llm_ms, tts_ms, total_ms, provedor)
                          values (:s, :l, :t, :tot, :p)"""), {"s": stt_ms, "l": llm_ms, "t": tts_ms, "tot": total_ms, "p": provedor})


def latencias_voz() -> list[dict]:
    with motor().connect() as c:
        return [dict(x._mapping) for x in c.execute(text(
            "select stt_ms, llm_ms, tts_ms, total_ms, provedor from voz_latencias order by id desc limit 1000"))]


# ---------- Gestores ----------

def gestor(usuario: str) -> dict | None:
    with motor().connect() as c:
        linha = c.execute(text("select usuario, nome, orgao_id, senha_hash, ativo from gestores where usuario = :u"),
                          {"u": usuario}).first()
    return dict(linha._mapping) if linha else None


# ---------- Retenção (LGPD) e cópia de segurança ----------

TEXTO_APAGADO = "[descrição apagada após o prazo de retenção]"


def vencidas(dias: int) -> list[dict]:
    """Ocorrências resolvidas há mais de `dias` que ainda têm foto, recorte ou descrição."""
    with motor().connect() as c:
        return [dict(x._mapping) for x in c.execute(text("""
            select o.id::text, o.protocolo, o.foto_path,
                   coalesce(array_agg(d.recorte_path) filter (where d.recorte_path is not null), '{}') as recortes
            from ocorrencias o left join deteccoes_frota d on d.ocorrencia_id = o.id
            where o.status = 'resolvida' and o.atualizada_em < now() - make_interval(days => :dias)
              and (o.foto_path is not null or o.descricao <> :apagado or d.recorte_path is not null)
            group by o.id"""), {"dias": dias, "apagado": TEXTO_APAGADO})]


def apagar_dados_vencidos(ids: list[str], dias: int) -> dict:
    """Depois que as fotos saíram do Storage: limpa os caminhos e a descrição; apaga eventos de som antigos."""
    with motor().begin() as c:
        n = c.execute(text("""update ocorrencias set foto_path = null, descricao = :apagado
                              where id = any(cast(:ids as uuid[]))"""), {"ids": ids, "apagado": TEXTO_APAGADO}).rowcount
        c.execute(text("update deteccoes_frota set recorte_path = null where ocorrencia_id = any(cast(:ids as uuid[]))"), {"ids": ids})
        som = c.execute(text("delete from eventos_som where recebido_em < now() - make_interval(days => :dias)"), {"dias": dias}).rowcount
    return {"ocorrencias": n, "eventos_som": som}


TABELAS_BACKUP = ("responsaveis", "categorias", "gestores", "ocorrencias", "historico_ocorrencia", "passagens_frota",
                  "deteccoes_frota", "eventos_som", "feedbacks", "guardrail_registros", "visao_chamadas", "voz_latencias",
                  "relatorios.rpa_execucoes")


def exportar(tabela: str):
    """Linhas de uma tabela como dicionários (para o backup em JSON)."""
    assert tabela in TABELAS_BACKUP
    with motor().connect() as c:
        for x in c.execute(text(f"select * from {tabela}")):
            yield dict(x._mapping)

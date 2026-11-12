"use client";
// Filas: tabela ordenada por prioridade, com o detalhe da ocorrência, Reclassificar (mesmo SeletorCategoria do cidadão)
// e Mudar status. O gestor vê todas as filas, mas só altera as do próprio órgão (a API confere e responde 403).
// Falhou ao salvar? A linha volta ao valor anterior e aparece o aviso: nada muda "de mentira".
import { ChevronDown, ChevronRight, MapPinned, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { Ocorrencia, Status } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Carregando } from "@/ui/Estados";
import { SeletorCategoria } from "@/ui/SeletorCategoria";
import { SeloConfianca, SeloOrigem, SeloPrioridade, SeloStatus } from "@/ui/Selo";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { coord, dataCurta, NOME_STATUS, useBase, useConsulta, useFiltros, useSairPorExpiracao } from "./hooks";

export interface Grupo { principal: Ocorrencia; itens: Ocorrencia[] }

const pesoStatus: Record<Status, number> = { pendente_envio: 0, enviada: 0, possivelmente_resolvida: 1, resolvida: 2 };

/** Junta os reportes do mesmo problema (mesmo grupo de duplicata) e ordena: abertos primeiro, depois prioridade. */
export function agrupar(lista: Ocorrencia[]): Grupo[] {
  const m = new Map<string, Ocorrencia[]>();
  for (const o of lista) {
    const k = o.grupo_duplicata_id ?? o.id;
    m.set(k, [...(m.get(k) ?? []), o]);
  }
  return [...m.values()].map((itens) => {
    // O reporte do cidadão fica na frente (tem a descrição escrita); depois, o mais recente.
    const ord = [...itens].sort((a, b) => b.prioridade - a.prioridade || Number(a.origem === "frota") - Number(b.origem === "frota")
      || b.criada_em.localeCompare(a.criada_em));
    return { principal: ord[0], itens: ord };
  }).sort((a, b) => pesoStatus[a.principal.status] - pesoStatus[b.principal.status]
    || b.principal.prioridade - a.principal.prioridade
    || b.principal.criada_em.localeCompare(a.principal.criada_em));
}

export function Filas() {
  const { estado } = useAppState();
  const orgao = estado.sessao!.orgao_id;
  const { consulta, abrir } = useFiltros();
  const f = consulta({ responsavel: orgao });
  const { nomeOrgao } = useBase();
  const { dados, erro, carregando, atualizar } = useConsulta(() => api.ocorrencias(f), JSON.stringify(f));

  return (
    <>
      <CabecalhoTela titulo="Filas" atualizar={atualizar} carregando={carregando}
        descricao={`Abre na fila de ${nomeOrgao(orgao)}. Você vê as outras filas, mas só altera as ocorrências do seu órgão.`}>
        <FiltrosConsole mostrar={["responsavel", "status", "categoria", "origem"]} padroes={{ responsavel: orgao }} />
      </CabecalhoTela>
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando a fila…" /></div>)
        : dados.length === 0 ? <VazioFiltrado />
        : <TabelaFila ocorrencias={dados} abrir={abrir} />}
    </>
  );
}

export function TabelaFila({ ocorrencias, abrir, titulo = "Ocorrências" }: { ocorrencias: Ocorrencia[]; abrir?: string | null; titulo?: string }) {
  const [ajustes, setAjustes] = useState<Record<string, Ocorrencia>>({});
  const [aberta, setAberta] = useState<string | null>(abrir ?? null);
  const lista = useMemo(() => ocorrencias.map((o) => ajustes[o.id] ?? o), [ocorrencias, ajustes]);
  const grupos = useMemo(() => agrupar(lista), [lista]);
  const { nomeCategoria } = useBase();
  const reportes = lista.length;

  const aplicar = (novas: Ocorrencia[]) => setAjustes((a) => ({ ...a, ...Object.fromEntries(novas.map((o) => [o.id, o])) }));

  return (
    <section className="glass overflow-hidden rounded-panel" aria-label={titulo}>
      <p className="px-4 pt-3 text-xs text-ink-muted md:px-5" aria-live="polite">
        {grupos.length} {grupos.length === 1 ? "problema" : "problemas"} · {reportes} {reportes === 1 ? "reporte" : "reportes"} (reportes do mesmo lugar ficam juntos)
      </p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{titulo}, ordenadas por prioridade. Abra uma linha para ver o detalhe e agir.</caption>
        <thead>
          <tr className="border-b border-line-strong text-left text-xs text-ink-muted">
            <th scope="col" className="py-2 pr-2 pl-4 font-semibold md:pl-5">Ocorrência</th>
            <th scope="col" className="hidden px-2 py-2 font-semibold md:table-cell">Prioridade</th>
            <th scope="col" className="hidden px-2 py-2 font-semibold lg:table-cell">Origem</th>
            <th scope="col" className="hidden px-2 py-2 font-semibold sm:table-cell">Status</th>
            <th scope="col" className="hidden px-2 py-2 font-semibold xl:table-cell">Confiança da IA</th>
            <th scope="col" className="hidden py-2 pr-5 pl-2 font-semibold lg:table-cell">Recebida</th>
          </tr>
        </thead>
        {grupos.map(({ principal: o, itens }) => {
          const aberto = aberta === o.id || itens.some((i) => i.id === aberta);
          const idDet = `det-${o.id}`;
          return (
            <tbody key={o.id} className="border-b border-border">
              <tr className={aberto ? "bg-rail-active/50" : "hover:bg-rail-active/30"}>
                <td className="py-2 pr-2 pl-2 md:pl-3">
                  <button type="button" aria-expanded={aberto} aria-controls={idDet} onClick={() => setAberta(aberto ? null : o.id)}
                    className="flex min-h-console w-full cursor-pointer items-start gap-2 rounded-chip p-1.5 text-left">
                    {aberto ? <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                    <span className="grid gap-0.5">
                      <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                      <span className="text-xs text-ink-muted">
                        {o.protocolo}{itens.length > 1 && ` · +${itens.length - 1} ${itens.length === 2 ? "reporte junto" : "reportes juntos"}`}
                        {(o.corrigida_pelo_gestor || o.corrigida_pelo_cidadao) && ` · corrigida pelo ${o.corrigida_pelo_gestor ? "gestor" : "cidadão"}`}
                      </span>
                      <span className="flex flex-wrap gap-1 pt-0.5 md:hidden">
                        <SeloPrioridade valor={o.prioridade} />
                        <span className="sm:hidden"><SeloStatus status={o.status} /></span>
                      </span>
                    </span>
                  </button>
                </td>
                <td className="hidden px-2 py-2 md:table-cell"><SeloPrioridade valor={o.prioridade} /></td>
                <td className="hidden px-2 py-2 lg:table-cell"><SeloOrigem origem={o.origem} /></td>
                <td className="hidden px-2 py-2 sm:table-cell"><SeloStatus status={o.status} /></td>
                <td className="hidden px-2 py-2 xl:table-cell">
                  {o.confianca > 0 ? <span className="flex items-center gap-1.5"><SeloConfianca valor={o.confianca} compacto /><span className="text-xs tabular-nums">{Math.round(o.confianca * 100)}%</span></span> : <span className="text-xs text-ink-muted">Escolhida pelo cidadão</span>}
                </td>
                <td className="hidden py-2 pr-5 pl-2 text-xs tabular-nums lg:table-cell">{dataCurta(o.criada_em)}</td>
              </tr>
              {aberto && (
                <tr id={idDet}>
                  <td colSpan={6} className="px-3 pb-4 md:px-5">
                    <DetalheOcorrencia grupo={{ principal: o, itens }} aplicar={aplicar} />
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </section>
  );
}

type Retorno = { tipo: "ok" | "danger"; titulo: string; texto: string } | null;

/** `aplicar` troca as ocorrências mostradas (usado para a mudança otimista e para desfazer). */
export function DetalheOcorrencia({ grupo, aplicar }: { grupo: Grupo; aplicar: (o: Ocorrencia[]) => void }) {
  const { principal: o, itens } = grupo;
  const { estado } = useAppState();
  const { categorias, responsaveis, nomeCategoria, nomeOrgao } = useBase();
  const expirou = useSairPorExpiracao();
  const [status, setStatus] = useState<Status>(o.status);
  const [categoria, setCategoria] = useState<string>(o.categoria_final);
  const [salvando, setSalvando] = useState(false);
  const [retorno, setRetorno] = useState<Retorno>(null);
  const meuOrgao = estado.sessao?.orgao_id === o.responsavel_id;
  const foto = itens.find((i) => i.foto_url)?.foto_url;

  /** Aplica na tela na hora (otimista) e confirma com a API, item por item do grupo. Se falhar, desfaz. */
  const salvar = async (mudanca: { status?: Status; categoria_final?: string }, ok: (n: Ocorrencia) => Retorno) => {
    if (salvando) return;
    const anteriores = itens;
    const cat = mudanca.categoria_final ? categorias.find((c) => c.id === mudanca.categoria_final) : undefined;
    aplicar(itens.map((i) => ({ ...i, ...mudanca, ...(cat ? { responsavel_id: cat.responsavel_id, corrigida_pelo_gestor: true } : {}) })));
    setSalvando(true);
    setRetorno(null);
    try {
      const novas: Ocorrencia[] = [];
      for (const i of itens) novas.push(await api.atualizarOcorrencia(i.id, mudanca));
      aplicar(novas);
      setRetorno(ok(novas[0]));
    } catch (e) {
      aplicar(anteriores);
      setStatus(o.status);
      setCategoria(o.categoria_final);
      const err = e instanceof ErroAPI ? e : null;
      if (err?.tipo === "login") return expirou();
      setRetorno({ tipo: "danger", titulo: err?.tipo === "proibido" ? "Esta ocorrência é de outro órgão" : "Não salvou", texto: err?.tipo === "proibido"
        ? `Você pode ver, mas só ${nomeOrgao(o.responsavel_id)} altera. Nada foi mudado.`
        : `${err?.mensagem ?? "Tente de novo."} A ocorrência voltou como estava.` });
    } finally {
      setSalvando(false);
    }
  };

  const vezes = itens.length > 1 ? ` (nos ${itens.length} reportes juntos)` : "";

  return (
    <div className="glass-card grid gap-4 rounded-card p-4 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        {!meuOrgao && (
          <Aviso tipo="info" titulo={`Fila de ${nomeOrgao(o.responsavel_id)}`}>Você pode ver esta ocorrência, mas só quem é desse órgão altera.</Aviso>
        )}
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-xs text-ink-muted">O que foi relatado</dt><dd className="text-base">“{o.descricao || "Sem descrição (detecção do ônibus)"}”</dd></div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div><dt className="text-xs text-ink-muted">Recebida</dt><dd>{dataCurta(o.criada_em)}</dd></div>
            <div><dt className="text-xs text-ink-muted">Local</dt><dd className="tabular-nums">{coord(o.lat, o.lon)}</dd></div>
            <div><dt className="text-xs text-ink-muted">Órgão</dt><dd>{nomeOrgao(o.responsavel_id)}</dd></div>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Classificação</dt>
            <dd>
              {o.categoria_sugerida ? <>IA sugeriu <strong>{nomeCategoria(o.categoria_sugerida)}</strong>{o.confianca > 0 && ` (${Math.round(o.confianca * 100)}%)`}</> : "Escolhida na lista"}
              {o.categoria_sugerida !== o.categoria_final && <> · ficou <strong>{nomeCategoria(o.categoria_final)}</strong></>}
              {o.corrigida_pelo_gestor && " · corrigida pelo gestor"}
            </dd>
          </div>
          {itens.length > 1 && (
            <div><dt className="text-xs text-ink-muted">Reportes juntos (mesmo lugar, até 50 m)</dt>
              <dd className="flex flex-wrap gap-1.5 pt-1">{itens.map((i) => <span key={i.id} className="rounded-chip bg-surface-raised px-2 py-0.5 text-xs tabular-nums">{i.protocolo}</span>)}</dd></div>
          )}
        </dl>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={`Foto da ocorrência ${o.protocolo}${o.origem !== "cidadao" ? " (recorte do ônibus, já borrado)" : ""}`} className="max-h-56 w-auto rounded-chip object-contain" />
        ) : <p className="text-xs text-ink-muted">{o.origem === "cidadao" ? "Sem foto." : "Sem recorte nesta passagem do ônibus."}</p>}
        <Link href={`/gestao/mapa?abrir=${o.id}`} className="inline-flex min-h-console w-max items-center gap-1.5 text-sm font-semibold underline underline-offset-4 hover:text-destaque">
          <MapPinned aria-hidden="true" className="size-4" />Ver no mapa
        </Link>
      </div>

      <div className="grid content-start gap-4">
        {retorno && <Aviso tipo={retorno.tipo} titulo={retorno.titulo}>{retorno.texto}</Aviso>}
        <form className="grid gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (status === o.status) { setRetorno({ tipo: "danger", titulo: "Escolha outro status", texto: `A ocorrência já está como “${NOME_STATUS[status]}”.` }); return; }
          salvar({ status }, () => ({ tipo: "ok", titulo: "Status salvo", texto: `Agora está como “${NOME_STATUS[status]}”${vezes}.` }));
        }}>
          <label htmlFor={`st-${o.id}`} className="text-base font-semibold">Mudar status</label>
          <div className="flex flex-wrap gap-2">
            <select id={`st-${o.id}`} value={status} onChange={(e) => setStatus(e.target.value as Status)}
              className="min-h-console flex-1 cursor-pointer rounded-chip border-[1.5px] border-line-strong bg-surface-raised px-2.5 text-sm text-ink">
              {(Object.keys(NOME_STATUS) as Status[]).map((s) => <option key={s} value={s}>{NOME_STATUS[s]}</option>)}
            </select>
            <button type="submit" aria-busy={salvando || undefined}
              className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-brand-hover">
              <Save aria-hidden="true" className="size-4" />Salvar status
            </button>
          </div>
        </form>
        <details className="grid gap-2">
          <summary className="inline-flex min-h-console cursor-pointer items-center text-base font-semibold underline underline-offset-4">Reclassificar (categoria errada)</summary>
          <div className="grid gap-3 pt-2">
            <SeletorCategoria categorias={categorias} responsaveis={responsaveis} selecionada={categoria}
              aoEscolher={(c) => setCategoria(c.id)} titulo="Qual é a categoria certa?" />
            <button type="button" aria-busy={salvando || undefined} onClick={() => {
              if (categoria === o.categoria_final) { setRetorno({ tipo: "danger", titulo: "Escolha outra categoria", texto: `Ela já está como “${nomeCategoria(categoria)}”.` }); return; }
              salvar({ categoria_final: categoria }, (n) => ({ tipo: "ok", titulo: "Reclassificada", texto:
                `Agora é “${nomeCategoria(n.categoria_final)}”${vezes}${n.responsavel_id !== o.responsavel_id ? ` e foi para a fila de ${nomeOrgao(n.responsavel_id)}` : ""}.` }));
            }}
              className="inline-flex min-h-console w-max cursor-pointer items-center gap-1.5 rounded-chip bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-brand-hover">
              <Save aria-hidden="true" className="size-4" />Salvar nova categoria
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}

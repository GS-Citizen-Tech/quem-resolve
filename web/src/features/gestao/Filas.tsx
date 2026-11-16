"use client";
// Filas: tabela ordenada por prioridade, com o detalhe da ocorrência, Reclassificar (mesmo SeletorCategoria do cidadão)
// e Mudar status. O gestor vê todas as filas, mas só altera as do próprio órgão (a API confere e responde 403).
// Falhou ao salvar? A linha volta ao valor anterior e aparece o aviso: nada muda "de mentira".
import { ChevronDown, ChevronRight, CircleHelp, MapPinned, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { HistoricoItem, Ocorrencia, Status } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Carregando } from "@/ui/Estados";
import { Selecao } from "@/ui/Selecao";
import { SeletorCategoria } from "@/ui/SeletorCategoria";
import { SeloPrioridade, SeloStatus, TextoOrigem } from "@/ui/Selo";
import { BOTAO_CONSOLE, CabecalhoTela, ErroConsulta } from "./Comum";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { coord, dataCurta, NOME_STATUS, useBase, useConsulta, useDistritos, useFiltros, useSairPorExpiracao } from "./hooks";

const POR_PAGINA = 20;

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
        descricao={`Você altera só as ocorrências de ${nomeOrgao(orgao)}.`}>
        <FiltrosConsole mostrar={["responsavel", "status", "categoria", "origem", "distrito"]} padroes={{ responsavel: orgao }} />
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
  const { nomeDistrito } = useDistritos();
  const reportes = lista.length;
  const [mostrando, setMostrando] = useState(POR_PAGINA);
  // A linha pedida no link (?abrir=) pode estar depois da primeira página: mostra até ela.
  const posAberta = aberta ? grupos.findIndex((g) => g.itens.some((i) => i.id === aberta)) : -1;
  const visiveis = grupos.slice(0, Math.max(mostrando, posAberta + 1));
  const faltam = grupos.length - visiveis.length;

  const aplicar = (novas: Ocorrencia[]) => setAjustes((a) => ({ ...a, ...Object.fromEntries(novas.map((o) => [o.id, o])) }));

  return (
    <section className="glass overflow-hidden rounded-panel" aria-label={titulo}>
      <p className="px-4 pt-3 pb-1 text-[13px] text-ink-muted md:px-5" aria-live="polite">
        <strong className="font-semibold text-ink">{grupos.length} {grupos.length === 1 ? "problema" : "problemas"}</strong>
        {reportes > grupos.length && `, somando ${reportes} reportes`}
      </p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{titulo}, ordenadas por prioridade. Abra uma linha para ver o detalhe e agir.</caption>
        <thead>
          <tr className="border-b border-[var(--qr-linha,var(--border))] text-left text-xs text-ink-muted">
            <th scope="col" className="py-2 pr-2 pl-4 font-medium md:pl-5">Problema</th>
            <th scope="col" className="hidden px-2 py-2 font-medium md:table-cell">Prioridade</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium md:table-cell">Reportes</th>
            <th scope="col" className="hidden px-2 py-2 pl-5 font-medium lg:table-cell">Quem viu</th>
            <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">Status</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium xl:table-cell">Certeza da IA</th>
            <th scope="col" className="hidden py-2 pr-5 pl-4 font-medium lg:table-cell">Recebida</th>
          </tr>
        </thead>
        {visiveis.map(({ principal: o, itens }) => {
          const aberto = aberta === o.id || itens.some((i) => i.id === aberta);
          const idDet = `det-${o.id}`;
          return (
            <tbody key={o.id} className="border-b border-[var(--qr-linha,var(--border))] last:border-b-0">
              <tr className={aberto ? "bg-[color-mix(in_srgb,var(--qr-ink)_5%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--qr-ink)_3%,transparent)]"}>
                <td className="py-1 pr-2 pl-2 md:pl-3">
                  <button type="button" aria-expanded={aberto} aria-controls={idDet} onClick={() => setAberta(aberto ? null : o.id)}
                    className="flex min-h-console w-full cursor-pointer items-start gap-2 rounded-chip p-1.5 text-left">
                    {aberto ? <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                    <span className="grid gap-0.5">
                      <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                      <span className="text-xs text-ink-muted">
                        <span className="font-mono">{o.protocolo}</span>
                        {o.distrito && `, ${nomeDistrito(o.distrito)}`}
                        {(o.corrigida_pelo_gestor || o.corrigida_pelo_cidadao) && `, corrigida pelo ${o.corrigida_pelo_gestor ? "gestor" : "cidadão"}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs md:hidden">
                        <SeloPrioridade valor={o.prioridade} curto />
                        {itens.length > 1 && <span>{itens.length} reportes</span>}
                        <span className="sm:hidden">{o.status === "pendente_envio" ? <span className="text-ink-muted">Aguardando envio</span> : <SeloStatus status={o.status} />}</span>
                      </span>
                    </span>
                  </button>
                </td>
                <td className="hidden px-2 py-1 md:table-cell"><SeloPrioridade valor={o.prioridade} curto /></td>
                <td className={`hidden px-2 py-1 text-right tabular-nums md:table-cell ${itens.length > 1 ? "font-semibold" : "text-ink-muted"}`}>{itens.length}</td>
                <td className="hidden px-2 py-1 pl-5 lg:table-cell"><TextoOrigem origem={o.origem} /></td>
                <td className="hidden px-2 py-1 sm:table-cell">
                  {o.status === "pendente_envio" ? <span className="text-ink-muted">Aguardando envio</span> : <SeloStatus status={o.status} />}
                </td>
                <td className="hidden px-2 py-1 text-right tabular-nums xl:table-cell">
                  {o.confianca <= 0 ? <span className="text-ink-muted">Escolha do cidadão</span>
                    : o.confianca < 0.5 ? <span className="inline-flex items-center gap-1 font-semibold text-danger"><CircleHelp aria-hidden="true" className="size-4" />{Math.round(o.confianca * 100)}%, conferir</span>
                    : <span className="text-ink-muted">{Math.round(o.confianca * 100)}%</span>}
                </td>
                <td className="hidden py-1 pr-5 pl-4 text-ink-muted tabular-nums lg:table-cell">{dataCurta(o.criada_em)}</td>
              </tr>
              {aberto && (
                <tr id={idDet}>
                  <td colSpan={7} className="px-3 pb-4 md:px-5">
                    <DetalheOcorrencia grupo={{ principal: o, itens }} aplicar={aplicar} />
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
      {faltam > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--qr-linha,var(--border))] px-4 py-2.5 md:px-5">
          <p className="text-[13px] text-ink-muted">Mostrando {visiveis.length} de {grupos.length}</p>
          <button type="button" onClick={() => setMostrando(visiveis.length + POR_PAGINA)} className={BOTAO_CONSOLE}>
            Mostrar mais {Math.min(POR_PAGINA, faltam)}
          </button>
        </div>
      )}
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
  const [observacao, setObservacao] = useState("");
  const [versao, setVersao] = useState(0); // muda a cada salvamento: o histórico recarrega
  const meuOrgao = estado.sessao?.orgao_id === o.responsavel_id;
  const foto = itens.find((i) => i.foto_url)?.foto_url;

  /** Aplica na tela na hora (otimista) e confirma com a API, item por item do grupo. Se falhar, desfaz. */
  const salvar = async (mudanca: { status?: Status; categoria_final?: string; observacao?: string }, ok: (n: Ocorrencia) => Retorno) => {
    if (salvando) return;
    const anteriores = itens;
    const cat = mudanca.categoria_final ? categorias.find((c) => c.id === mudanca.categoria_final) : undefined;
    const { observacao: _obs, ...campos } = mudanca;
    aplicar(itens.map((i) => ({ ...i, ...campos, ...(cat ? { responsavel_id: cat.responsavel_id, corrigida_pelo_gestor: true } : {}) })));
    setSalvando(true);
    setRetorno(null);
    try {
      const novas: Ocorrencia[] = [];
      for (const i of itens) novas.push(await api.atualizarOcorrencia(i.id, mudanca));
      aplicar(novas);
      setRetorno(ok(novas[0]));
      setObservacao("");
      setVersao((v) => v + 1);
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
    <div className="grid gap-6 rounded-card border border-[var(--qr-linha,var(--border))] bg-surface-raised p-4 lg:grid-cols-2">
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
              {o.categoria_sugerida !== o.categoria_final && <>, ficou <strong>{nomeCategoria(o.categoria_final)}</strong></>}
              {o.corrigida_pelo_gestor && ", corrigida pelo gestor"}
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
          salvar({ status, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) }, () => ({ tipo: "ok", titulo: "Status salvo", texto: `Agora está como “${NOME_STATUS[status]}”${vezes}.` }));
        }}>
          <label htmlFor={`st-${o.id}`} className="text-base font-semibold">Mudar status</label>
          <div className="flex flex-wrap gap-2">
            <Selecao id={`st-${o.id}`} valor={status} aoMudar={(v) => setStatus(v as Status)} className="flex-1"
              opcoes={(Object.keys(NOME_STATUS) as Status[]).map((s) => ({ valor: s, rotulo: NOME_STATUS[s] }))} />
            <button type="submit" aria-busy={salvando || undefined}
              className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-brand-hover">
              <Save aria-hidden="true" className="size-4" />Salvar status
            </button>
          </div>
          <label htmlFor={`obs-${o.id}`} className="text-xs text-ink-muted">Observação (opcional, vai para o histórico)</label>
          <input id={`obs-${o.id}`} value={observacao} maxLength={500} onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: equipe foi ao local"
            className="min-h-console rounded-chip border border-line-strong bg-surface-raised px-2.5 text-sm text-ink" />
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
        <Historico id={o.id} versao={versao} />
      </div>
    </div>
  );
}

/** Quem mudou o quê (v0.9). Recarrega quando `versao` muda (depois de salvar). */
function Historico({ id, versao }: { id: string; versao: number }) {
  const { nomeCategoria } = useBase();
  const [itens, setItens] = useState<HistoricoItem[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.historico(id).then((h) => { if (vivo) { setItens(h); setFalhou(false); } }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [id, versao]);
  const valor = (campo: HistoricoItem["campo"], v: string | null) =>
    !v ? "—" : campo === "status" ? NOME_STATUS[v as Status] ?? v : nomeCategoria(v);
  return (
    <section aria-label="Histórico de mudanças" className="grid gap-1.5">
      <h3 className="text-base font-semibold">Histórico</h3>
      {falhou ? <p className="text-xs text-ink-muted">Não deu para carregar o histórico agora.</p>
        : !itens ? <p className="text-xs text-ink-muted">Carregando…</p>
        : itens.length === 0 ? <p className="text-xs text-ink-muted">Nenhuma mudança ainda.</p>
        : (
          <ol className="grid gap-1 text-sm">
            {itens.map((h, i) => (
              <li key={i} className="grid gap-0.5 border-l-2 border-line-strong pl-2.5">
                <span className="text-xs text-ink-muted">{dataCurta(h.em)} · {h.quem}</span>
                <span>{h.campo === "status" ? "Status" : "Categoria"}: {valor(h.campo, h.de)} → <strong>{valor(h.campo, h.para)}</strong></span>
                {h.observacao && <span className="text-xs">“{h.observacao}”</span>}
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}

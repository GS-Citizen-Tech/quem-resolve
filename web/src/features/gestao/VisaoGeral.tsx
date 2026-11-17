"use client";
// Visão geral = painel de ação (17/11, docs/PLANO-VISAO-GERAL.md). Responde "o que eu resolvo agora, onde fica,
// e resolvo daqui mesmo": 4 atalhos que filtram a lista, "O que fazer agora" com ação direta na linha,
// mapa pequeno só com esses pontos e a gaveta com o detalhe (a mesma peça das Filas). Embaixo, a tendência.
// Abre no órgão de quem entrou ("Todos os órgãos" a um clique). Os filtros ficam na URL.
import { ArrowRight, CircleCheck, Clock, Inbox, OctagonAlert, Send, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { Ocorrencia, Status } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Carregando } from "@/ui/Estados";
import { Gaveta } from "@/ui/Gaveta";
import { GraficoDias } from "@/ui/GraficoPlotly";
import { MapaOcorrencias, tomDaOcorrencia, type PontoMapa } from "@/ui/MapaOcorrencias";
import { SeloPrioridade, SeloStatus } from "@/ui/Selo";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { agrupar, DetalheOcorrencia, type Grupo } from "./Filas";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { dataCurta, useBase, useConsulta, useDistritos, useFiltros, useSairPorExpiracao } from "./hooks";

const DIA = 86_400_000;
const NA_LISTA = 8;
type Foco = "alta" | "novos" | "parados" | "confirmar";
const aberto = (o: Ocorrencia) => o.status === "pendente_envio" || o.status === "enviada";
const maisAntiga = (g: Grupo) => Math.min(...g.itens.map((i) => new Date(i.criada_em).getTime()));
const maisNova = (g: Grupo) => Math.max(...g.itens.map((i) => new Date(i.criada_em).getTime()));
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function VisaoGeral() {
  const { estado } = useAppState();
  const orgao = estado.sessao!.orgao_id;
  const { filtros, definir, consulta, sufixo } = useFiltros();
  const { nomeCategoria, nomeOrgao } = useBase();
  const { nomeDistrito } = useDistritos();
  const expirou = useSairPorExpiracao();
  const { categoria, responsavel, distrito } = consulta({ responsavel: orgao });
  const f = { categoria, responsavel, distrito };
  const { dados, erro, carregando, atualizar } = useConsulta(() => api.ocorrencias(f), JSON.stringify(f));
  const [agora] = useState(() => Date.now());

  const [foco, setFoco] = useState<Foco | null>(null);
  const [aberta, setAberta] = useState<string | null>(null); // grupo na gaveta
  const [sobre, setSobre] = useState<string | null>(null);   // linha com o mouse em cima (acende no mapa)
  const [ajustes, setAjustes] = useState<Record<string, Ocorrencia>>({});
  const [feitos, setFeitos] = useState<Record<string, Status>>({}); // ação feita na linha → status de antes (Desfazer)
  const [falha, setFalha] = useState<string | null>(null);
  const aplicar = (novas: Ocorrencia[]) => setAjustes((a) => ({ ...a, ...Object.fromEntries(novas.map((o) => [o.id, o])) }));

  const lista = useMemo(() => (dados ?? []).map((o) => ajustes[o.id] ?? o), [dados, ajustes]);
  const grupos = useMemo(() => agrupar(lista), [lista]);

  const conjuntos = useMemo<Record<Foco, Grupo[]>>(() => ({
    alta: grupos.filter((g) => aberto(g.principal) && g.principal.prioridade >= 4),
    novos: grupos.filter((g) => agora - maisNova(g) < DIA),
    parados: grupos.filter((g) => g.principal.status === "pendente_envio" && agora - maisAntiga(g) > 7 * DIA),
    confirmar: grupos.filter((g) => g.principal.status === "possivelmente_resolvida"),
  }), [grupos, agora]);

  // "O que fazer agora": maior prioridade, depois mais reportes, depois o mais antigo. Linhas em que a pessoa
  // acabou de agir continuam aparecendo (com "Desfazer") até atualizar.
  const fila = useMemo(() => {
    const base = foco ? conjuntos[foco] : grupos.filter((g) => aberto(g.principal) || feitos[g.principal.id]);
    const ids = new Set(base.map((g) => g.principal.id));
    const extra = grupos.filter((g) => feitos[g.principal.id] && !ids.has(g.principal.id));
    return [...base, ...extra].sort((a, b) => b.principal.prioridade - a.principal.prioridade
      || b.itens.length - a.itens.length || maisAntiga(a) - maisAntiga(b));
  }, [foco, conjuntos, grupos, feitos]);
  const visiveis = fila.slice(0, NA_LISTA);

  const pontos = useMemo<PontoMapa[]>(() => visiveis.map(({ principal: o, itens }) => ({
    id: o.id, lat: o.lat, lon: o.lon, origem: o.origem, tom: tomDaOcorrencia(o), quantidade: itens.length,
    titulo: `${nomeCategoria(o.categoria_final)}, ${itens.length} ${itens.length === 1 ? "reporte" : "reportes"}`,
  })), [visiveis, nomeCategoria]);

  const tendencia = useMemo(() => {
    const dias: string[] = [];
    const idx = new Map<string, number>();
    for (let i = 29; i >= 0; i--) { const d = fmtDia.format(new Date(agora - i * DIA)); idx.set(d, dias.length); dias.push(d); }
    const alta = Array(30).fill(0), media = Array(30).fill(0), baixa = Array(30).fill(0);
    for (const o of lista) {
      const i = idx.get(fmtDia.format(new Date(o.criada_em)));
      if (i == null || agora - new Date(o.criada_em).getTime() > 30 * DIA) continue;
      (o.prioridade >= 4 ? alta : o.prioridade === 3 ? media : baixa)[i]++;
    }
    return { dias, series: [
      { nome: "Alta", cor: "--qr-danger", valores: alta },
      { nome: "Média", cor: "--qr-warn", valores: media },
      { nome: "Baixa", cor: "--chart-1", valores: baixa },
    ] };
  }, [lista, agora]);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of grupos) if (aberto(g.principal)) m.set(g.principal.categoria_final, (m.get(g.principal.categoria_final) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [grupos]);

  /** Ação direta na linha: muda o status do grupo todo (otimista; se a API recusar, volta como estava). */
  const agir = async (g: Grupo, para: Status, desfazendo = false) => {
    const antes = g.itens;
    const de = g.principal.status;
    setFalha(null);
    aplicar(g.itens.map((i) => ({ ...i, status: para })));
    setFeitos((x) => { const n = { ...x }; if (desfazendo) delete n[g.principal.id]; else n[g.principal.id] = de; return n; });
    try {
      const novas: Ocorrencia[] = [];
      for (const i of g.itens) novas.push(await api.atualizarOcorrencia(i.id, { status: para }));
      aplicar(novas);
    } catch (e) {
      aplicar(antes);
      setFeitos((x) => { const n = { ...x }; if (desfazendo) n[g.principal.id] = para; else delete n[g.principal.id]; return n; });
      const err = e instanceof ErroAPI ? e : null;
      if (err?.tipo === "login") return expirou();
      setFalha(err?.tipo === "proibido" ? `Só ${nomeOrgao(g.principal.responsavel_id)} pode mudar esta ocorrência.` : `${err?.mensagem ?? "Não salvou."} Nada foi mudado.`);
    }
  };

  const grupoAberto = grupos.find((g) => g.principal.id === aberta || g.itens.some((i) => i.id === aberta));
  const todos = responsavel == null;
  const ATALHOS: { k: Foco; rotulo: string; nota: string; icone: LucideIcon; alerta?: boolean }[] = [
    { k: "alta", rotulo: "Prioridade alta em aberto", nota: "Risco ou muitos reportes", icone: OctagonAlert, alerta: true },
    { k: "novos", rotulo: "Novos em 24 horas", nota: "Chegaram desde ontem", icone: Inbox },
    { k: "parados", rotulo: "Parados há mais de 7 dias", nota: "Ainda aguardando envio", icone: Clock, alerta: true },
    { k: "confirmar", rotulo: "Possivelmente resolvidas", nota: "O ônibus não viu de novo", icone: CircleCheck },
  ];
  const tituloLista = foco ? ATALHOS.find((a) => a.k === foco)!.rotulo : "O que fazer agora";

  return (
    <>
      <CabecalhoTela titulo="Visão geral" atualizar={() => { setFeitos({}); setAjustes({}); atualizar(); }} carregando={carregando}
        descricao={todos ? "O que pede ação agora em todos os órgãos." : `O que pede ação agora em ${nomeOrgao(responsavel)}.`}>
        <FiltrosConsole mostrar={["responsavel", "categoria", "distrito"]} padroes={{ responsavel: orgao }} />
      </CabecalhoTela>
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando o que pede ação…" /></div>)
        : dados.length === 0 ? <VazioFiltrado /> : (
        <div aria-busy={carregando || undefined} className="grid gap-4">
          <div role="group" aria-label="Atalhos: cada número filtra a lista abaixo" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {ATALHOS.map(({ k, rotulo, nota, icone: Icone, alerta }) => {
              const n = conjuntos[k].length;
              const ativo = foco === k;
              const perigo = alerta && n > 0;
              return (
                <button key={k} type="button" aria-pressed={ativo} onClick={() => setFoco(ativo ? null : k)}
                  className={`glass-card grid cursor-pointer content-start gap-1 rounded-card px-4 py-3.5 text-left transition-colors motion-reduce:transition-none hover:border-ink ${ativo ? "!border-ink shadow-[inset_0_0_0_1px_var(--qr-ink)]" : ""}`}>
                  <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink-muted">
                    {rotulo}{ativo && <span className="rounded-chip bg-destaque-soft px-1.5 text-xs font-semibold text-ink">Filtrando</span>}
                  </span>
                  <span className={`flex items-center gap-2 text-[30px] leading-9 font-semibold tracking-[-0.025em] tabular-nums ${perigo ? "text-danger" : ""}`}>
                    {(perigo || (n > 0 && !alerta)) && <Icone aria-hidden="true" className="size-6" strokeWidth={2} />}{n}
                  </span>
                  <span className="text-xs text-ink-muted">{nota}</span>
                </button>
              );
            })}
          </div>

          <section className="glass grid gap-3 rounded-panel p-3 md:p-4" aria-labelledby="agora-t">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <h2 id="agora-t" className="text-[17px] font-semibold">
                    {tituloLista} <span className="font-normal text-ink-muted tabular-nums">({fila.length})</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    {foco && <button type="button" onClick={() => setFoco(null)} className="min-h-console cursor-pointer text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink">Ver tudo em aberto</button>}
                    <Link href={`/gestao/filas${sufixo}`} className="inline-flex min-h-console items-center gap-1 text-[13px] font-semibold underline underline-offset-4 hover:text-destaque">
                      Abrir a fila completa<ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </div>
                {falha && <Aviso tipo="danger" titulo="Não deu para mudar">{falha}</Aviso>}
                {visiveis.length === 0 ? (
                  <p className="px-1 py-6 text-base">{foco ? "Nada aqui agora." : "Nada em aberto. Tudo encaminhado."}</p>
                ) : (
                  <ul className="grid" onMouseLeave={() => setSobre(null)}>
                    {visiveis.map((g) => {
                      const o = g.principal;
                      const meu = o.responsavel_id === orgao;
                      const dias = Math.floor((agora - maisAntiga(g)) / DIA);
                      const feito = feitos[o.id];
                      const acao: { para: Status; rotulo: string; icone: LucideIcon } | null =
                        !meu ? null : o.status === "pendente_envio" ? { para: "enviada", rotulo: "Encaminhar", icone: Send }
                          : o.status === "possivelmente_resolvida" ? { para: "resolvida", rotulo: "Confirmar resolvida", icone: CircleCheck } : null;
                      return (
                        <li key={o.id} onMouseEnter={() => setSobre(o.id)} onFocus={() => setSobre(o.id)}
                          className={`flex items-center gap-2 border-t border-[var(--qr-linha,var(--border))] py-1 first:border-t-0 ${sobre === o.id ? "bg-[color-mix(in_srgb,var(--qr-ink)_4%,transparent)]" : ""}`}>
                          <button type="button" onClick={() => setAberta(o.id)} aria-haspopup="dialog"
                            className="grid min-h-console flex-1 cursor-pointer gap-1 rounded-chip px-2 py-2 text-left">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <SeloPrioridade valor={o.prioridade} curto />
                              <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                              {o.distrito && <span className="text-ink-muted">{nomeDistrito(o.distrito)}</span>}
                            </span>
                            <span className="text-[13px] text-ink-muted">
                              {g.itens.length} {g.itens.length === 1 ? "reporte" : "reportes"}, {dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`}
                              {(todos || !meu) && `, ${nomeOrgao(o.responsavel_id)}`}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-2 pr-1">
                            {feito ? (
                              <>
                                <SeloStatus status={o.status} />
                                <button type="button" onClick={() => agir(g, feito, true)}
                                  className="inline-flex min-h-console cursor-pointer items-center gap-1 rounded-chip px-2 text-[13px] font-semibold underline underline-offset-4">
                                  <Undo2 aria-hidden="true" className="size-3.5" />Desfazer
                                </button>
                              </>
                            ) : acao ? (
                              <button type="button" onClick={() => agir(g, acao.para)}
                                aria-label={`${acao.rotulo}: ${nomeCategoria(o.categoria_final)}${o.distrito ? ` em ${nomeDistrito(o.distrito)}` : ""}`}
                                className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip border border-line-strong bg-surface-raised px-3 text-[13px] font-semibold hover:border-ink">
                                <acao.icone aria-hidden="true" className="size-3.5" />{acao.rotulo}
                              </button>
                            ) : o.status !== "pendente_envio" ? <SeloStatus status={o.status} /> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {fila.length > NA_LISTA && (
                  <p className="px-1 text-[13px] text-ink-muted">
                    Mostrando as {NA_LISTA} mais urgentes de {fila.length}. <Link href={`/gestao/filas${sufixo}`} className="font-semibold text-ink underline underline-offset-4">Ver todas na fila</Link>
                  </p>
                )}
              </div>
              <div className="h-[360px] lg:h-auto lg:min-h-[420px]">
                <MapaOcorrencias rotulo={`Mapa de: ${tituloLista}`} altura="100%" pontos={pontos}
                  selecionado={sobre ?? grupoAberto?.principal.id ?? null} seguir={false} aoSelecionar={setAberta} />
              </div>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[2fr_1fr]">
            <section className="glass rounded-panel p-4 md:p-5">
              <GraficoDias titulo="Reportes novos por dia" descricao="Últimos 30 dias, separados pela prioridade." dias={tendencia.dias} series={tendencia.series} />
            </section>
            <section className="glass rounded-panel p-4 md:p-5" aria-labelledby="cat-t">
              <h2 id="cat-t" className="text-[15px] font-semibold">Mais comuns em aberto</h2>
              <p className="text-xs text-ink-muted">Clique para filtrar a tela.</p>
              <ul className="mt-2 grid gap-1">
                {categorias.map(([id, n]) => {
                  const ativo = filtros.categoria === id;
                  return (
                    <li key={id}>
                      <button type="button" aria-pressed={ativo} onClick={() => definir("categoria", ativo ? undefined : id)}
                        className="grid min-h-console w-full cursor-pointer gap-1 rounded-chip px-2 py-1.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--qr-ink)_5%,transparent)] aria-pressed:bg-destaque-soft">
                        <span className="flex items-baseline justify-between gap-2"><span>{nomeCategoria(id)}</span><span className="font-semibold tabular-nums">{n}</span></span>
                        <span aria-hidden="true" className="h-1.5 rounded-pill bg-chart-1" style={{ width: `${Math.max(6, (n / categorias[0][1]) * 100)}%` }} />
                      </button>
                    </li>
                  );
                })}
                {!categorias.length && <li className="px-2 py-2 text-sm text-ink-muted">Nada em aberto.</li>}
              </ul>
            </section>
          </div>
        </div>
      )}

      <Gaveta aberta={!!grupoAberto} aoFechar={() => setAberta(null)}
        titulo={grupoAberto ? nomeCategoria(grupoAberto.principal.categoria_final) : ""}
        subtitulo={grupoAberto && <>
          <span className="font-mono">{grupoAberto.principal.protocolo}</span>
          {grupoAberto.principal.distrito && `, ${nomeDistrito(grupoAberto.principal.distrito)}`}, recebida {dataCurta(grupoAberto.principal.criada_em)}
        </>}>
        {grupoAberto && <DetalheOcorrencia key={grupoAberto.principal.id} grupo={grupoAberto} aplicar={aplicar} empilhado />}
      </Gaveta>
    </>
  );
}

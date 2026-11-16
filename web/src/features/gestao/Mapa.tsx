"use client";
// Mapa do console (v1.3, docs/PLANO-MAPA-CONSOLE.md).
// - Cidade: os 96 distritos (malha do IBGE) pintados pelos problemas abertos; toque num bairro para focar nele.
// - Bairro: só os relatos dali; o painel mostra o resumo do bairro e leva à fila filtrada.
// - Bolas: tamanho = nº de reportes do mesmo problema (agrupamento de duplicatas), cor = prioridade, forma = quem achou.
// A lista (recolhida) tem os mesmos pontos: funciona sem mapa, sem internet para o fundo e com leitor de tela.
import { ArrowLeft, ChevronRight, Clock, FilterX, ListOrdered, MapPinned, SlidersHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/providers/api";
import type { Ocorrencia } from "@/providers/tipos";
import { Aviso } from "@/ui/Aviso";
import { Carregando } from "@/ui/Estados";
import { GraficoPlotly } from "@/ui/GraficoPlotly";
import { LegendaMapa, MapaOcorrencias, tomDaOcorrencia, type AreasMapa, type PontoMapa } from "@/ui/MapaOcorrencias";
import { Selecao } from "@/ui/Selecao";
import { SeloOrigem, SeloPrioridade, SeloStatus } from "@/ui/Selo";
import { BOTAO_CONSOLE, BotaoAtualizar, ErroConsulta } from "./Comum";
import { agrupar, type Grupo } from "./Filas";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { dataCurta, NOME_ORIGEM, NOME_STATUS, useBase, useConsulta, useDistritos, useFiltros, type ChaveFiltro } from "./hooks";

/** Faixas dos bairros (problemas abertos): 0 · 1–3 · 4–8 · 9–15 · 16+. */
const FAIXAS = [0, 3, 8, 15];
const PERIODOS = [{ valor: "7", rotulo: "7 dias" }, { valor: "30", rotulo: "30 dias" }, { valor: "tudo", rotulo: "Tudo" }] as const;
const NA_LISTA = 30;

const aberto = (o: Ocorrencia) => o.status === "pendente_envio" || o.status === "enviada";
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export function Mapa() {
  const { filtros, consulta, definir, limpar, abrir } = useFiltros();
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const { distrito, ...semDistrito } = consulta();
  // A cidade inteira vem de uma vez: trocar de bairro é instantâneo e os tons dos bairros usam os mesmos dados.
  const { dados, erro, carregando, atualizar } = useConsulta(() => api.ocorrencias(semDistrito), JSON.stringify(semDistrito));
  const { dados: malha, carregando: carregandoMalha, atualizar: recarregarMalha } = useConsulta(() => api.malhaDistritos().catch(() => null), "malha-distritos");
  const { distritos, nomeDistrito } = useDistritos(malha ? ":malha" : "");
  // Primeira subida da API: ela ainda pode estar baixando os bairros do IBGE. Tenta de novo sozinho a cada 30 s.
  useEffect(() => {
    if (malha || carregandoMalha) return;
    const t = setTimeout(recarregarMalha, 30_000);
    return () => clearTimeout(t);
  }, [malha, carregandoMalha, recarregarMalha]);
  const { nomeCategoria } = useBase();
  const [selecionado, setSelecionado] = useState<string | null>(abrir);
  // "Agora" fixo ao abrir a tela (o período conta a partir daí; Atualizar recarrega os dados).
  const [agora] = useState(() => Date.now());

  const periodo = params.get("periodo") ?? "30";
  const mudarPeriodo = (v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v === "30") p.delete("periodo"); else p.set("periodo", v);
    router.replace(p.toString() ? `${caminho}?${p}` : caminho, { scroll: false });
  };
  const escolherDistrito = useCallback((id: string | null) => { setSelecionado(null); definir("distrito", id ?? undefined); }, [definir]);

  const noPeriodo = useMemo(() => {
    if (!dados) return [];
    if (periodo === "tudo") return dados;
    const limite = agora - Number(periodo) * 86_400_000;
    return dados.filter((o) => new Date(o.criada_em).getTime() >= limite);
  }, [dados, periodo, agora]);
  const gruposCidade = useMemo(() => agrupar(noPeriodo), [noPeriodo]);
  const grupos = useMemo(() => (distrito ? gruposCidade.filter((g) => g.principal.distrito === distrito) : gruposCidade), [gruposCidade, distrito]);

  const abertosPorDistrito = useMemo(() => {
    const v: Record<string, number> = {};
    for (const g of gruposCidade) if (g.principal.distrito && aberto(g.principal)) v[g.principal.distrito] = (v[g.principal.distrito] ?? 0) + 1;
    return v;
  }, [gruposCidade]);

  const areas = useMemo<AreasMapa | undefined>(() => malha ? {
    geojson: malha, valores: abertosPorDistrito, faixas: FAIXAS, selecionada: distrito ?? null, aoEscolher: escolherDistrito,
    rotuloDe: (id) => { const n = abertosPorDistrito[id] ?? 0; return `${nomeDistrito(id)} · ${n} ${n === 1 ? "problema aberto" : "problemas abertos"}`; },
  } : undefined, [malha, abertosPorDistrito, distrito, escolherDistrito, nomeDistrito]);

  const pontos = useMemo<PontoMapa[]>(() => grupos.map(({ principal: o, itens }) => ({
    id: o.id, lat: o.lat, lon: o.lon, origem: o.origem, tom: tomDaOcorrencia(o), quantidade: itens.length,
    titulo: `${nomeCategoria(o.categoria_final)} · ${itens.length} ${itens.length === 1 ? "reporte" : "reportes"} · prioridade ${o.prioridade}`,
  })), [grupos, nomeCategoria]);
  const escolhido = grupos.find((g) => g.principal.id === selecionado || g.itens.some((i) => i.id === selecionado));

  const outrosFiltros = (["categoria", "responsavel", "origem", "status"] as ChaveFiltro[]).filter((k) => filtros[k]);

  return (
    <>
      <header className="grid gap-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2">
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.025em]">Mapa</h1>
            <nav aria-label="Onde você está no mapa" className="flex flex-wrap items-center gap-1 text-2xl leading-8 tracking-[-0.025em] text-ink-muted">
              <ChevronRight aria-hidden="true" className="size-5" />
              {distrito ? (
                <button type="button" onClick={() => escolherDistrito(null)} className="cursor-pointer underline decoration-1 underline-offset-4 hover:text-ink">São Paulo</button>
              ) : <span aria-current="page">São Paulo</span>}
              {distrito && <>
                <ChevronRight aria-hidden="true" className="size-5" />
                <span className="font-semibold text-ink" aria-current="page">{nomeDistrito(distrito)}</span>
              </>}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="ir-bairro">Ir para o bairro</label>
            <Selecao id="ir-bairro" value={distrito ?? ""} onChange={(e) => escolherDistrito(e.target.value || null)} className="w-56">
              <option value="">Ir para o bairro…</option>
              {distritos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </Selecao>
            <BotaoAtualizar atualizar={() => { atualizar(); if (!malha) recarregarMalha(); }} carregando={carregando} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Período" className="inline-flex rounded-chip border border-line-strong bg-surface-raised p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.valor} type="button" role="radio" aria-checked={periodo === p.valor} onClick={() => mudarPeriodo(p.valor)}
                className={`inline-flex min-h-[30px] cursor-pointer items-center rounded-[7px] px-3 text-sm ${periodo === p.valor ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-ink-muted hover:text-ink"}`}>
                {p.rotulo}
              </button>
            ))}
          </div>
          {outrosFiltros.map((k) => (
            <button key={k} type="button" onClick={() => definir(k, undefined)} aria-label={`Tirar o filtro ${valorFiltro(k, filtros[k]!, nomeCategoria)}`}
              className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip bg-destaque-soft px-3 text-sm font-semibold text-ink hc:border-2 hc:border-line-strong">
              {valorFiltro(k, filtros[k]!, nomeCategoria)}<FilterX aria-hidden="true" className="size-4" />
            </button>
          ))}
          <details className="group relative">
            <summary className={`${BOTAO_CONSOLE} list-none [&::-webkit-details-marker]:hidden`}>
              <SlidersHorizontal aria-hidden="true" className="size-4" />Filtros
            </summary>
            <div className="absolute left-0 z-[600] mt-2 w-[min(92vw,660px)] rounded-card border border-line-strong bg-surface-raised p-4 shadow-glass">
              <FiltrosConsole mostrar={["categoria", "responsavel", "origem", "status"]} />
            </div>
          </details>
          {(outrosFiltros.length > 0 || distrito) && (
            <button type="button" onClick={limpar} className="min-h-console cursor-pointer px-2 text-sm font-semibold underline underline-offset-4">Limpar tudo</button>
          )}
        </div>
      </header>

      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os pontos…" /></div>) : dados.length === 0 ? <VazioFiltrado /> : (
        <>
          <section className="glass grid gap-3 rounded-panel p-3 md:p-4" aria-label="Mapa das ocorrências">
            <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
              <div className="h-[min(70dvh,720px)] min-h-[420px]">
                <MapaOcorrencias rotulo={distrito ? `Mapa do bairro ${nomeDistrito(distrito)}` : "Mapa da cidade com os bairros"} altura="100%"
                  pontos={pontos} areas={areas} selecionado={escolhido?.principal.id} aoSelecionar={setSelecionado} />
              </div>
              <div aria-live="polite" className="grid content-start">
                {escolhido ? (
                  <ResumoPonto grupo={escolhido} voltar={() => setSelecionado(null)} />
                ) : distrito ? (
                  <ResumoBairro id={distrito} grupos={grupos} escolher={setSelecionado} />
                ) : (
                  <ResumoCidade grupos={gruposCidade} abertos={abertosPorDistrito} temMalha={!!malha} carregandoMalha={carregandoMalha} escolher={escolherDistrito} />
                )}
              </div>
            </div>
            <LegendaMapa bolhas faixas={malha ? FAIXAS : undefined} />
          </section>
          <ListaPontos grupos={grupos} selecionado={escolhido?.principal.id} escolher={setSelecionado} />
        </>
      )}
    </>
  );
}

function valorFiltro(k: ChaveFiltro, v: string, nomeCategoria: (id: string) => string) {
  if (k === "categoria") return nomeCategoria(v);
  if (k === "origem") return NOME_ORIGEM[v as keyof typeof NOME_ORIGEM] ?? v;
  if (k === "status") return NOME_STATUS[v as keyof typeof NOME_STATUS] ?? v;
  return v === "todos" ? "Todos os órgãos" : v;
}

// ---------- Painel lateral ----------

function Numero({ valor, rotulo, alerta }: { valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className="glass-card grid gap-0.5 rounded-card px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        {alerta && valor > 0 && <TriangleAlert aria-hidden="true" className="size-5 text-danger" />}{valor}
      </span>
      <span className="text-xs text-ink-muted">{rotulo}</span>
    </div>
  );
}

function ResumoCidade({ grupos, abertos, temMalha, carregandoMalha, escolher }: {
  grupos: Grupo[]; abertos: Record<string, number>; temMalha: boolean; carregandoMalha: boolean; escolher: (id: string) => void;
}) {
  const { nomeDistrito } = useDistritos();
  const abertosG = grupos.filter((g) => aberto(g.principal));
  const top = Object.entries(abertos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <section aria-label="Resumo da cidade" className="glass-card grid content-start gap-3 rounded-card p-4 text-sm">
      <h2 className="text-lg font-semibold">Toda a cidade</h2>
      <div className="grid grid-cols-2 gap-2">
        <Numero valor={abertosG.length} rotulo="problemas abertos" />
        <Numero valor={abertosG.filter((g) => g.principal.prioridade >= 4).length} rotulo="de prioridade alta" alerta />
      </div>
      {temMalha ? (
        <>
          <h3 className="font-semibold">Bairros com mais problemas abertos</h3>
          <ol className="grid gap-1">
            {top.map(([id, n]) => (
              <li key={id}>
                <button type="button" onClick={() => escolher(id)}
                  className="flex min-h-console w-full cursor-pointer items-center gap-2 rounded-chip px-2 text-left hover:bg-rail-active/45">
                  <span>{nomeDistrito(id)}</span>
                  <span className="ml-auto font-semibold tabular-nums">{n}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <Aviso tipo={carregandoMalha ? "info" : "warn"} titulo={carregandoMalha ? "Carregando os bairros…" : "Bairros ainda não carregados"}>
          {carregandoMalha
            ? "Os pontos já aparecem."
            : "Os pontos aparecem normalmente. O mapa tenta de novo sozinho em 30 segundos."}
        </Aviso>
      )}
    </section>
  );
}

function ResumoBairro({ id, grupos, escolher }: { id: string; grupos: Grupo[]; escolher: (id: string) => void }) {
  const { nomeDistrito } = useDistritos();
  const { nomeCategoria } = useBase();
  const abertosG = grupos.filter((g) => aberto(g.principal));
  const porCategoria = new Map<string, number>();
  for (const g of abertosG) porCategoria.set(g.principal.categoria_final, (porCategoria.get(g.principal.categoria_final) ?? 0) + 1);
  const barras = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => ({ chave: c, rotulo: nomeCategoria(c), valor: n }));
  const maisAntigo = [...abertosG].sort((a, b) => a.principal.criada_em.localeCompare(b.principal.criada_em))[0];
  const maior = [...abertosG].sort((a, b) => b.itens.length - a.itens.length)[0];
  return (
    <section aria-label={`Resumo do bairro ${nomeDistrito(id)}`} className="glass-card grid content-start gap-3 rounded-card p-4 text-sm">
      <h2 className="text-lg font-semibold">{nomeDistrito(id)}</h2>
      {grupos.length === 0 ? <p className="text-ink-muted">Nenhum relato neste bairro com os filtros e o período escolhidos.</p> : <>
        <div className="grid grid-cols-3 gap-2">
          <Numero valor={abertosG.length} rotulo="abertos" />
          <Numero valor={abertosG.filter((g) => g.principal.prioridade >= 4).length} rotulo="prioridade alta" alerta />
          <Numero valor={grupos.reduce((s, g) => s + g.itens.length, 0)} rotulo="reportes" />
        </div>
        {barras.length > 0 && <GraficoPlotly titulo="Tipos de problema abertos" dados={barras} unidade="problemas" />}
        {maior && maior.itens.length > 1 && (
          <button type="button" onClick={() => escolher(maior.principal.id)} className="flex min-h-console cursor-pointer items-center gap-2 rounded-chip px-2 text-left hover:bg-rail-active/45">
            <MapPinned aria-hidden="true" className="size-4 shrink-0 text-destaque" />
            <span>Mais reportado: <strong>{nomeCategoria(maior.principal.categoria_final)}</strong>, {maior.itens.length} reportes</span>
          </button>
        )}
        {maisAntigo && (
          <button type="button" onClick={() => escolher(maisAntigo.principal.id)} className="flex min-h-console cursor-pointer items-center gap-2 rounded-chip px-2 text-left hover:bg-rail-active/45">
            <Clock aria-hidden="true" className="size-4 shrink-0 text-destaque" />
            <span>Aberto há mais tempo: <strong>{nomeCategoria(maisAntigo.principal.categoria_final)}</strong>, há {diasDesde(maisAntigo.principal.criada_em)} dias</span>
          </button>
        )}
      </>}
      <Link href={`/gestao/filas?distrito=${id}`}
        className="inline-flex min-h-console w-max items-center gap-1.5 rounded-chip bg-primary px-3 font-semibold text-primary-foreground hover:bg-brand-hover">
        <ListOrdered aria-hidden="true" className="size-4" />Abrir a fila deste bairro
      </Link>
    </section>
  );
}

function ResumoPonto({ grupo, voltar }: { grupo: Grupo; voltar: () => void }) {
  const { nomeCategoria, nomeOrgao } = useBase();
  const { nomeDistrito } = useDistritos();
  const o: Ocorrencia = grupo.principal;
  const n = grupo.itens.length;
  return (
    <section aria-label="Ponto escolhido" className="glass-card grid content-start gap-2 rounded-card p-4 text-sm">
      <button type="button" onClick={voltar} className="inline-flex min-h-console w-max cursor-pointer items-center gap-1 text-sm font-semibold underline underline-offset-4">
        <ArrowLeft aria-hidden="true" className="size-4" />Voltar ao resumo
      </button>
      <h2 className="text-lg font-semibold">{nomeCategoria(o.categoria_final)}</h2>
      <p className="text-xs text-ink-muted">{o.protocolo} · {dataCurta(o.criada_em)}{o.distrito ? ` · ${nomeDistrito(o.distrito)}` : ""}</p>
      <p className="text-base font-semibold">{n} {n === 1 ? "reporte" : "reportes do mesmo problema"}</p>
      <div className="flex flex-wrap gap-1"><SeloPrioridade valor={o.prioridade} /><SeloOrigem origem={o.origem} /><SeloStatus status={o.status} /></div>
      {o.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.foto_url} alt="Foto do cidadão (rostos e placas borrados)" className="aspect-[4/3] w-full rounded-card object-cover" />
      )}
      {o.descricao && <p>“{o.descricao}”</p>}
      <p className="text-xs">Órgão: <strong>{nomeOrgao(o.responsavel_id)}</strong></p>
      <Link href={`/gestao/filas?responsavel=${o.responsavel_id}&abrir=${o.id}`}
        className="inline-flex min-h-console w-max items-center gap-1.5 rounded-chip bg-primary px-3 font-semibold text-primary-foreground hover:bg-brand-hover">
        <ListOrdered aria-hidden="true" className="size-4" />Abrir na fila
      </Link>
    </section>
  );
}

// ---------- Lista (mesmos pontos, recolhida) ----------

function ListaPontos({ grupos, selecionado, escolher }: { grupos: Grupo[]; selecionado?: string; escolher: (id: string) => void }) {
  const { nomeCategoria } = useBase();
  const { nomeDistrito } = useDistritos();
  const [todas, setTodas] = useState(false);
  const ordem = useMemo(() => [...grupos].sort((a, b) => b.itens.length - a.itens.length || b.principal.prioridade - a.principal.prioridade), [grupos]);
  return (
    <details className="glass rounded-panel p-3 md:p-4">
      <summary className="min-h-console cursor-pointer text-base font-semibold">Ver em lista ({grupos.length} pontos)</summary>
      <ul className="mt-2 grid gap-1">
        {(todas ? ordem : ordem.slice(0, NA_LISTA)).map(({ principal: o, itens }) => (
          <li key={o.id}>
            <button type="button" onClick={() => { escolher(o.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-pressed={selecionado === o.id}
              className="flex min-h-console w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-chip px-2 py-1.5 text-left text-sm hover:bg-rail-active/45 aria-pressed:bg-rail-active aria-pressed:text-on-rail-active">
              <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
              <span className="text-xs text-ink-muted">{o.distrito ? nomeDistrito(o.distrito) : "Sem bairro"} · {itens.length} {itens.length === 1 ? "reporte" : "reportes"}</span>
              <span className="ml-auto flex gap-1"><SeloPrioridade valor={o.prioridade} /><SeloOrigem origem={o.origem} /></span>
            </button>
          </li>
        ))}
      </ul>
      {!todas && ordem.length > NA_LISTA && (
        <button type="button" onClick={() => setTodas(true)} className="mt-2 min-h-console cursor-pointer px-2 text-sm font-semibold underline underline-offset-4">
          Mostrar todos os {ordem.length}
        </button>
      )}
    </details>
  );
}

"use client";
// Mapa: os mesmos filtros da visão geral, pontos por origem e prioridade, resumo do ponto escolhido e link para a fila.
// Embaixo do mapa fica sempre a lista (funciona sem mapa, sem internet para o mapa de fundo e com leitor de tela).
import { ListOrdered } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/providers/api";
import type { Ocorrencia } from "@/providers/tipos";
import { Carregando } from "@/ui/Estados";
import { LegendaMapa, MapaOcorrencias, tomDaOcorrencia, type PontoMapa } from "@/ui/MapaOcorrencias";
import { SeloOrigem, SeloPrioridade, SeloStatus } from "@/ui/Selo";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { agrupar, type Grupo } from "./Filas";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { coord, dataCurta, useBase, useConsulta, useFiltros } from "./hooks";

const NA_LISTA = 25;

export function Mapa() {
  const { consulta, abrir } = useFiltros();
  const f = consulta();
  const { dados, erro, carregando, atualizar } = useConsulta(() => api.ocorrencias(f), JSON.stringify(f));
  const { nomeCategoria } = useBase();
  const [selecionado, setSelecionado] = useState<string | null>(abrir);
  const [todas, setTodas] = useState(false);

  const grupos = useMemo(() => agrupar(dados ?? []), [dados]);
  const pontos = useMemo<PontoMapa[]>(() => grupos.map(({ principal: o, itens }) => ({
    id: o.id, lat: o.lat, lon: o.lon, origem: o.origem, tom: tomDaOcorrencia(o),
    titulo: `${nomeCategoria(o.categoria_final)} · prioridade ${o.prioridade}${itens.length > 1 ? ` · ${itens.length} reportes` : ""}`,
  })), [grupos, nomeCategoria]);
  const escolhido = grupos.find((g) => g.principal.id === selecionado || g.itens.some((i) => i.id === selecionado));

  return (
    <>
      <CabecalhoTela titulo="Mapa" descricao="Toque num ponto para ver o resumo. A lista embaixo tem os mesmos pontos." atualizar={atualizar} carregando={carregando}>
        <FiltrosConsole mostrar={["categoria", "responsavel", "origem", "status"]} />
      </CabecalhoTela>
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os pontos…" /></div>) : dados.length === 0 ? <VazioFiltrado /> : (
        <>
          <section className="glass grid gap-3 rounded-panel p-3 md:p-4" aria-label="Mapa das ocorrências">
            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <MapaOcorrencias rotulo="Mapa das ocorrências filtradas" pontos={pontos} selecionado={escolhido?.principal.id} aoSelecionar={setSelecionado} />
              <ResumoPonto grupo={escolhido} />
            </div>
            <LegendaMapa />
          </section>
          <section className="glass rounded-panel p-3 md:p-4" aria-labelledby="lista-mapa">
            <h2 id="lista-mapa" className="mb-2 text-base font-semibold">Pontos no mapa ({grupos.length})</h2>
            <ul className="grid gap-1">
              {(todas ? grupos : grupos.slice(0, NA_LISTA)).map(({ principal: o, itens }) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setSelecionado(o.id)} aria-pressed={escolhido?.principal.id === o.id}
                    className="flex min-h-console w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-chip px-2 py-1.5 text-left text-sm hover:bg-rail-active/45 aria-pressed:bg-rail-active aria-pressed:text-on-rail-active">
                    <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                    <span className="text-xs tabular-nums text-ink-muted">{coord(o.lat, o.lon)}{itens.length > 1 && ` · ${itens.length} reportes`}</span>
                    <span className="ml-auto flex gap-1"><SeloPrioridade valor={o.prioridade} /><SeloOrigem origem={o.origem} /></span>
                  </button>
                </li>
              ))}
            </ul>
            {!todas && grupos.length > NA_LISTA && (
              <button type="button" onClick={() => setTodas(true)} className="mt-2 min-h-console cursor-pointer px-2 text-sm font-semibold underline underline-offset-4">
                Mostrar todos os {grupos.length}
              </button>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ResumoPonto({ grupo }: { grupo?: Grupo }) {
  const { nomeCategoria, nomeOrgao } = useBase();
  if (!grupo) {
    return <div className="glass-card grid place-items-center rounded-card p-4 text-center text-sm text-ink-muted">Escolha um ponto no mapa ou na lista para ver o resumo.</div>;
  }
  const o: Ocorrencia = grupo.principal;
  return (
    <section aria-live="polite" aria-label="Ponto escolhido" className="glass-card grid content-start gap-2 rounded-card p-4 text-sm">
      <h2 className="text-lg font-semibold">{nomeCategoria(o.categoria_final)}</h2>
      <p className="text-xs text-ink-muted">{o.protocolo} · {dataCurta(o.criada_em)}{grupo.itens.length > 1 && ` · ${grupo.itens.length} reportes juntos`}</p>
      <div className="flex flex-wrap gap-1"><SeloPrioridade valor={o.prioridade} /><SeloOrigem origem={o.origem} /><SeloStatus status={o.status} /></div>
      {o.descricao && <p>“{o.descricao}”</p>}
      <p className="text-xs">Órgão: <strong>{nomeOrgao(o.responsavel_id)}</strong></p>
      <Link href={`/gestao/filas?responsavel=${o.responsavel_id}&abrir=${o.id}`}
        className="inline-flex min-h-console w-max items-center gap-1.5 rounded-chip bg-primary px-3 font-semibold text-primary-foreground hover:bg-brand-hover">
        <ListOrdered aria-hidden="true" className="size-4" />Abrir na fila
      </Link>
    </section>
  );
}

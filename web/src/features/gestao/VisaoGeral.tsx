"use client";
// Visão geral: 4 números (o que chegou, o que pede ação), categorias em barras (Plotly) e quem viu o problema.
// Os filtros mudam tudo na hora e ficam na URL.
import { OctagonAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/providers/api";
import type { Metricas, Ocorrencia } from "@/providers/tipos";
import { BarraPartes } from "@/ui/BarraPartes";
import { Carregando } from "@/ui/Estados";
import { GraficoPlotly } from "@/ui/GraficoPlotly";
import { Indicador } from "@/ui/Indicador";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { agrupar } from "./Filas";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { NOME_ORIGEM, pct, useBase, useConsulta, useDistritos, useFiltros } from "./hooks";

interface Dados { m: Metricas; lista: Ocorrencia[] }
const ORDEM_ORIGEM = ["cidadao", "ambos", "frota"];
const SEMANA = 7 * 86_400_000;

export function VisaoGeral() {
  const { filtros, definir, consulta, sufixo } = useFiltros();
  const { nomeCategoria } = useBase();
  const { nomeDistrito } = useDistritos();
  const { categoria, responsavel, origem, distrito } = consulta();
  const f = { categoria, responsavel, origem, distrito };
  const { dados, erro, carregando, atualizar } = useConsulta<Dados>(async () => {
    const [m, lista] = await Promise.all([api.metricas(f), api.ocorrencias(f)]);
    return { m, lista };
  }, JSON.stringify(f));
  const [agora] = useState(() => Date.now());
  const m = dados?.m;

  const resumo = useMemo(() => {
    const lista = dados?.lista ?? [];
    const abertos = agrupar(lista).filter((g) => g.principal.status !== "resolvida");
    const porBairro = new Map<string, number>();
    for (const g of abertos) if (g.principal.distrito) porBairro.set(g.principal.distrito, (porBairro.get(g.principal.distrito) ?? 0) + 1);
    return {
      semana: lista.filter((o) => agora - new Date(o.criada_em).getTime() < SEMANA).length,
      alta: abertos.filter((g) => g.principal.prioridade >= 4).length,
      bairros: [...porBairro.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [dados, agora]);

  return (
    <>
      <CabecalhoTela titulo="Visão geral" atualizar={atualizar} carregando={carregando}>
        <FiltrosConsole mostrar={["categoria", "responsavel", "origem", "distrito"]} />
      </CabecalhoTela>
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!m} />}
      {!m ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os números…" /></div>) : (
        <div aria-busy={carregando || undefined} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Indicador rotulo="Ocorrências" valor={m.total.toLocaleString("pt-BR")}
              nota={resumo.semana ? `${resumo.semana} nos últimos 7 dias` : "Nenhuma nos últimos 7 dias"} />
            <Indicador rotulo="Prioridade alta em aberto" valor={String(resumo.alta)} icone={resumo.alta ? OctagonAlert : undefined} tom={resumo.alta ? "danger" : undefined}
              nota={resumo.alta ? "Risco maior ou muitos reportes" : "Nada urgente agora"} />
            <Indicador rotulo="De outros órgãos" valor={pct(m.pct_fora_prefeitura, 1)} nota="Enel, Sabesp, Comgás, CET" />
            <Indicador rotulo="Corrigidas pelo cidadão" valor={pct(m.taxa_correcao_cidadao, 1)} nota="A IA sugeriu outra categoria" />
          </div>
          {m.total === 0 ? <VazioFiltrado /> : (
            <div className="grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
              <section className="glass rounded-panel p-4 md:p-5">
                <GraficoPlotly titulo="Por categoria" destaque={filtros.categoria} maximo={8}
                  dados={m.por_categoria.map((c) => ({ chave: c.chave, rotulo: nomeCategoria(c.chave), valor: c.total }))}
                  aoClicar={(c) => definir("categoria", filtros.categoria === c ? undefined : c)} />
              </section>
              <div className="grid gap-4">
                <section className="glass rounded-panel p-4 md:p-5">
                  <BarraPartes titulo="Quem viu o problema" destaque={filtros.origem}
                    partes={ORDEM_ORIGEM.map((k) => ({ chave: k, rotulo: NOME_ORIGEM[k as keyof typeof NOME_ORIGEM], valor: m.por_origem.find((o) => o.chave === k)?.total ?? 0 }))}
                    aoClicar={(o) => definir("origem", filtros.origem === o ? undefined : o)} />
                </section>
                {resumo.bairros.length > 0 && !distrito && (
                  <section className="glass rounded-panel p-4 md:p-5" aria-labelledby="bairros-t">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 id="bairros-t" className="text-[15px] font-semibold">Bairros com mais problemas em aberto</h2>
                      <Link href={`/gestao/mapa${sufixo}`} className="text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink">Ver no mapa</Link>
                    </div>
                    <ol className="mt-2 grid">
                      {resumo.bairros.map(([id, n]) => (
                        <li key={id}>
                          <button type="button" onClick={() => definir("distrito", id)}
                            className="flex min-h-console w-full cursor-pointer items-center gap-3 rounded-chip px-2 text-left text-sm hover:bg-[color-mix(in_srgb,var(--qr-ink)_5%,transparent)]">
                            <span className="flex-1">{nomeDistrito(id)}</span>
                            <span className="font-semibold tabular-nums">{n}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

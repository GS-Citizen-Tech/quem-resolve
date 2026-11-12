"use client";
// Visão geral: 3 indicadores + gráfico Plotly por categoria e por origem, com os filtros mudando tudo na hora.
import { Building2, ListChecks, UserRoundPen } from "lucide-react";
import { api } from "@/providers/api";
import type { Metricas } from "@/providers/tipos";
import { Carregando } from "@/ui/Estados";
import { GraficoPlotly } from "@/ui/GraficoPlotly";
import { Indicador } from "@/ui/Indicador";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { FiltrosConsole, VazioFiltrado } from "./FiltrosConsole";
import { NOME_ORIGEM, pct, useBase, useConsulta, useFiltros } from "./hooks";

export function VisaoGeral() {
  const { filtros, definir, consulta } = useFiltros();
  const { nomeCategoria } = useBase();
  const { categoria, responsavel, origem } = consulta();
  const chave = JSON.stringify({ categoria, responsavel, origem });
  const { dados: m, erro, carregando, atualizar } = useConsulta<Metricas>(() => api.metricas({ categoria, responsavel, origem }), chave);

  return (
    <>
      <CabecalhoTela titulo="Visão geral" descricao="Ocorrências recebidas pelo app e pelos ônibus. Toque numa barra para filtrar por ela."
        atualizar={atualizar} carregando={carregando}>
        <FiltrosConsole />
      </CabecalhoTela>
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!m} />}
      {!m ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os números…" /></div>) : (
        <div aria-busy={carregando || undefined} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Indicador icone={ListChecks} rotulo="Ocorrências" valor={m.total.toLocaleString("pt-BR")} nota="Com os filtros marcados" />
            <Indicador icone={Building2} rotulo="Fora da Prefeitura" valor={pct(m.pct_fora_prefeitura, 1)} nota="Enel, Sabesp, Comgás, CET e outros" />
            <Indicador icone={UserRoundPen} rotulo="Corrigidas pelo cidadão" valor={pct(m.taxa_correcao_cidadao, 1)} nota="O cidadão trocou a categoria que a IA sugeriu" />
          </div>
          {m.total === 0 ? <VazioFiltrado /> : (
            <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
              <section className="glass rounded-panel p-4 md:p-5">
                <GraficoPlotly titulo="Ocorrências por categoria" destaque={filtros.categoria}
                  dados={m.por_categoria.map((c) => ({ chave: c.chave, rotulo: nomeCategoria(c.chave), valor: c.total }))}
                  aoClicar={(c) => definir("categoria", filtros.categoria === c ? undefined : c)} />
              </section>
              <section className="glass rounded-panel p-4 md:p-5">
                <GraficoPlotly titulo="Quem encontrou o problema" horizontal={false} destaque={filtros.origem}
                  descricao="“Cidadão + ônibus” é o mesmo problema visto pelos dois: ganha prioridade."
                  dados={m.por_origem.map((o) => ({ chave: o.chave, rotulo: NOME_ORIGEM[o.chave as keyof typeof NOME_ORIGEM] ?? o.chave, valor: o.total }))}
                  aoClicar={(o) => definir("origem", filtros.origem === o ? undefined : o)} />
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}

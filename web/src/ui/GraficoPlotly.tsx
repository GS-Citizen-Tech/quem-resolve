"use client";
// Gráfico de barras com Plotly (design system: TelaConsole). Cores do tema resolvidas na hora, fundo transparente
// para o vidro aparecer, aria-label com todos os valores e a mesma informação em tabela ("Ver como tabela").
// O Plotly é carregado só quando o gráfico aparece (import dinâmico), para não pesar o app do cidadão.
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface Barra { chave: string; rotulo: string; valor: number }

/** Muda quando o tema muda (classe "dark" ou data-theme no <html>), para redesenhar com as cores certas. */
function useVersaoTema() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setV((x) => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return v;
}

const lerCor = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

export const OUTRAS = "__outras";

export function GraficoPlotly({ titulo, dados: todos, horizontal = true, unidade = "ocorrências", destaque, aoClicar, descricao, maximo }: {
  titulo: string; dados: Barra[]; horizontal?: boolean; unidade?: string;
  /** Chave em destaque (ex.: categoria filtrada): fica na cor principal e as outras em cinza. */
  destaque?: string;
  aoClicar?: (chave: string) => void;
  descricao?: string;
  /** Mostra só as `maximo` maiores barras e soma o resto em "Outras" (a tabela continua com todas). */
  maximo?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const tema = useVersaoTema();
  const [falhou, setFalhou] = useState(false);
  const clique = useRef(aoClicar);
  useEffect(() => { clique.current = aoClicar; });

  const dados = useMemo(() => {
    if (!maximo || todos.length <= maximo + 1) return todos;
    const ord = [...todos].sort((a, b) => b.valor - a.valor);
    const resto = ord.slice(maximo);
    return [...ord.slice(0, maximo), { chave: OUTRAS, rotulo: `Outras ${resto.length}`, valor: resto.reduce((s, d) => s + d.valor, 0) }];
  }, [todos, maximo]);
  const altura = horizontal ? Math.max(96, dados.length * 34 + 12) : 220;
  const resumo = `${titulo}. ${todos.map((d) => `${d.rotulo}: ${d.valor}`).join("; ")}.`;

  useEffect(() => {
    const div = ref.current;
    if (!div || !dados.length) return;
    let vivo = true;
    import("plotly.js-dist-min").then(({ default: Plotly }) => {
      if (!vivo) return;
      const principal = lerCor("--chart-1");
      const secundaria = lerCor("--chart-2");
      const tinta = lerCor("--qr-ink");
      const fonte = getComputedStyle(document.body).fontFamily;
      const ordem = horizontal ? [...dados].reverse() : dados; // no Plotly, a barra horizontal de cima é a última
      const cores = ordem.map((d) => (d.chave === OUTRAS || (destaque && d.chave !== destaque) ? secundaria : principal));
      // Sem grade nem eixo de valores: o número vai escrito no fim de cada barra.
      const eixoValor = { showgrid: false, zeroline: false, showticklabels: false, fixedrange: true, rangemode: "tozero" as const };
      const eixoNome = { tickfont: { size: 13, color: tinta }, automargin: true, fixedrange: true, showgrid: false, ticksuffix: horizontal ? "  " : "", showline: false, ticks: "" as const };
      Plotly.react(div, [{
        type: "bar",
        orientation: horizontal ? "h" : "v",
        x: horizontal ? ordem.map((d) => d.valor) : ordem.map((d) => d.rotulo),
        y: horizontal ? ordem.map((d) => d.rotulo) : ordem.map((d) => d.valor),
        customdata: ordem.map((d) => d.chave),
        text: ordem.map((d) => String(d.valor)),
        textposition: "outside",
        textfont: { size: 13, color: tinta },
        cliponaxis: false,
        marker: { color: cores },
        hovertemplate: `%{${horizontal ? "y" : "x"}}: %{${horizontal ? "x" : "y"}} ${unidade}<extra></extra>`,
      }], {
        height: altura,
        margin: { l: 4, r: 40, t: horizontal ? 4 : 24, b: horizontal ? 4 : 32 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { family: fonte, size: 12, color: tinta },
        xaxis: horizontal ? eixoValor : eixoNome,
        yaxis: horizontal ? eixoNome : eixoValor,
        bargap: horizontal ? 0.42 : 0.5,
        ...({ barcornerradius: 4 } as object), // cantos das barras (o tipo do Plotly ainda não conhece)
        hoverlabel: { font: { family: fonte, size: 13 } },
      }, { displayModeBar: false, responsive: true }).then(() => {
        const el = div as unknown as { removeAllListeners?: (n: string) => void; on: (n: string, f: (e: { points: { customdata: string }[] }) => void) => void };
        el.removeAllListeners?.("plotly_click");
        el.on("plotly_click", (e) => { const c = e.points[0]?.customdata; if (c && c !== OUTRAS) clique.current?.(c); });
      });
    }).catch(() => vivo && setFalhou(true));
    return () => { vivo = false; };
  }, [dados, destaque, horizontal, altura, unidade, tema]);

  useEffect(() => {
    const div = ref.current;
    return () => { if (div) import("plotly.js-dist-min").then(({ default: P }) => P.purge(div)).catch(() => {}); };
  }, []);

  return (
    <figure className="grid gap-2" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="text-[15px] font-semibold">{titulo}</figcaption>
      {descricao && <p className="text-xs text-ink-muted">{descricao}</p>}
      {todos.length === 0 ? null : falhou ? (
        <p className="text-sm text-ink-muted">Não deu para desenhar o gráfico. Os números estão na tabela abaixo.</p>
      ) : (
        <div ref={ref} role="img" aria-label={resumo} style={{ minHeight: altura }} className={aoClicar ? "cursor-pointer" : ""} />
      )}
      <details className="group" open={falhou || undefined}>
        <summary className="inline-flex min-h-console cursor-pointer list-none items-center rounded-chip text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver como tabela</span><span className="hidden group-open:inline">Esconder tabela</span>
        </summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead><tr className="border-b border-line-strong text-left text-ink-muted">
            <th scope="col" className="py-1.5 font-semibold">Item</th>
            <th scope="col" className="py-1.5 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>
            {todos.map((d) => (
              <tr key={d.chave} className="border-b border-border">
                <th scope="row" className="py-1.5 text-left font-normal">{d.rotulo}</th>
                <td className="py-1.5 text-right tabular-nums">{d.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

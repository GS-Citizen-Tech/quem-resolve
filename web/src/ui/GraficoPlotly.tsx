"use client";
// Gráfico de barras com Plotly (design system: TelaConsole). Cores do tema resolvidas na hora, fundo transparente
// para o vidro aparecer, aria-label com todos os valores e a mesma informação em tabela ("Ver como tabela").
// O Plotly é carregado só quando o gráfico aparece (import dinâmico), para não pesar o app do cidadão.
import { useEffect, useId, useRef, useState } from "react";

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

export function GraficoPlotly({ titulo, dados, horizontal = true, unidade = "ocorrências", destaque, aoClicar, descricao }: {
  titulo: string; dados: Barra[]; horizontal?: boolean; unidade?: string;
  /** Chave em destaque (ex.: categoria filtrada): fica na cor principal e as outras em cinza. */
  destaque?: string;
  aoClicar?: (chave: string) => void;
  descricao?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const tema = useVersaoTema();
  const [falhou, setFalhou] = useState(false);
  const clique = useRef(aoClicar);
  useEffect(() => { clique.current = aoClicar; });

  const altura = horizontal ? Math.max(130, dados.length * 30 + 60) : 260;
  const resumo = `${titulo}. ${dados.map((d) => `${d.rotulo}: ${d.valor}`).join("; ")}.`;

  useEffect(() => {
    const div = ref.current;
    if (!div || !dados.length) return;
    let vivo = true;
    import("plotly.js-dist-min").then(({ default: Plotly }) => {
      if (!vivo) return;
      const principal = lerCor("--chart-1");
      const secundaria = lerCor("--chart-2");
      const tinta = lerCor("--qr-ink");
      const grade = lerCor("--border");
      const fonte = getComputedStyle(document.body).fontFamily;
      const ordem = horizontal ? [...dados].reverse() : dados; // no Plotly, a barra horizontal de cima é a última
      const cores = ordem.map((d) => (!destaque || d.chave === destaque ? principal : secundaria));
      const eixoValor = { gridcolor: grade, zeroline: false, tickfont: { size: 12, color: tinta }, fixedrange: true, rangemode: "tozero" as const };
      const eixoNome = { tickfont: { size: 12, color: tinta }, automargin: true, fixedrange: true, showgrid: false };
      Plotly.react(div, [{
        type: "bar",
        orientation: horizontal ? "h" : "v",
        x: horizontal ? ordem.map((d) => d.valor) : ordem.map((d) => d.rotulo),
        y: horizontal ? ordem.map((d) => d.rotulo) : ordem.map((d) => d.valor),
        customdata: ordem.map((d) => d.chave),
        text: ordem.map((d) => String(d.valor)),
        textposition: "outside",
        textfont: { size: 12, color: tinta },
        cliponaxis: false,
        marker: { color: cores },
        hovertemplate: `%{${horizontal ? "y" : "x"}}: %{${horizontal ? "x" : "y"}} ${unidade}<extra></extra>`,
      }], {
        height: altura,
        margin: { l: 8, r: 36, t: 8, b: horizontal ? 28 : 40 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { family: fonte, size: 12, color: tinta },
        xaxis: horizontal ? eixoValor : eixoNome,
        yaxis: horizontal ? eixoNome : { ...eixoValor, showticklabels: false }, // em pé, o valor já vai em cima da barra
        bargap: 0.35,
        hoverlabel: { font: { family: fonte, size: 13 } },
      }, { displayModeBar: false, responsive: true }).then(() => {
        const el = div as unknown as { removeAllListeners?: (n: string) => void; on: (n: string, f: (e: { points: { customdata: string }[] }) => void) => void };
        el.removeAllListeners?.("plotly_click");
        el.on("plotly_click", (e) => { const c = e.points[0]?.customdata; if (c) clique.current?.(c); });
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
      <figcaption id={`${id}-t`} className="text-base font-semibold">{titulo}</figcaption>
      {descricao && <p className="text-xs text-ink-muted">{descricao}</p>}
      {dados.length === 0 ? null : falhou ? (
        <p className="text-sm text-ink-muted">Não deu para desenhar o gráfico. Os números estão na tabela abaixo.</p>
      ) : (
        <div ref={ref} role="img" aria-label={resumo} style={{ minHeight: altura }} className={aoClicar ? "cursor-pointer" : ""} />
      )}
      <details className="group" open={falhou || undefined}>
        <summary className="inline-flex min-h-console cursor-pointer items-center rounded-chip px-1 text-sm font-semibold text-ink underline underline-offset-4 hover:text-destaque">
          <span className="group-open:hidden">Ver como tabela</span><span className="hidden group-open:inline">Esconder tabela</span>
        </summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead><tr className="border-b border-line-strong text-left text-ink-muted">
            <th scope="col" className="py-1.5 font-semibold">Item</th>
            <th scope="col" className="py-1.5 text-right font-semibold">Total</th>
          </tr></thead>
          <tbody>
            {dados.map((d) => (
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

"use client";
// Filtros do console (categoria, órgão, origem e status). Ficam na URL: a tela muda na hora e o link pode ser compartilhado.
import { FilterX } from "lucide-react";
import { useId } from "react";
import { NOME_ORIGEM, NOME_STATUS, useBase, useFiltros, type ChaveFiltro } from "./hooks";

const ROTULO: Record<ChaveFiltro, string> = { categoria: "Categoria", responsavel: "Órgão responsável", origem: "Origem", status: "Status" };

export function FiltrosConsole({ mostrar = ["categoria", "responsavel", "origem"], padroes = {} }: {
  mostrar?: ChaveFiltro[];
  /** Valor usado quando o filtro não está na URL (ex.: Filas abre no órgão da pessoa). */
  padroes?: Partial<Record<ChaveFiltro, string>>;
}) {
  const id = useId();
  const { filtros, definir, limpar, ativos } = useFiltros();
  const { categorias, responsaveis } = useBase();

  const opcoes: Record<ChaveFiltro, { valor: string; rotulo: string }[]> = {
    categoria: [...categorias].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ valor: c.id, rotulo: c.nome })),
    responsavel: [...responsaveis].sort((a, b) => a.nome.localeCompare(b.nome)).map((r) => ({ valor: r.id, rotulo: r.nome })),
    origem: (Object.keys(NOME_ORIGEM) as (keyof typeof NOME_ORIGEM)[]).map((o) => ({ valor: o, rotulo: NOME_ORIGEM[o] })),
    status: (Object.keys(NOME_STATUS) as (keyof typeof NOME_STATUS)[]).map((s) => ({ valor: s, rotulo: NOME_STATUS[s] })),
  };

  return (
    <section aria-label="Filtros" className="flex flex-wrap items-end gap-3">
      {mostrar.map((k) => {
        const padrao = padroes[k];
        const atual = filtros[k] ?? padrao ?? "";
        return (
          <div key={k} className="grid min-w-40 flex-1 gap-1 sm:flex-none">
            <label htmlFor={`${id}-${k}`} className="text-xs font-semibold text-ink-muted">{ROTULO[k]}</label>
            <select id={`${id}-${k}`} value={atual} onChange={(e) => definir(k, e.target.value || (padrao ? "todos" : undefined))}
              className="min-h-console w-full cursor-pointer rounded-chip border-[1.5px] border-line-strong bg-surface-raised px-2.5 text-sm text-ink sm:w-52">
              <option value={padrao ? "todos" : ""}>{k === "responsavel" ? "Todos os órgãos" : k === "status" ? "Todos os status" : "Todas"}</option>
              {opcoes[k].map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </div>
        );
      })}
      {ativos > 0 && (
        <button type="button" onClick={limpar}
          className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip px-3 text-sm font-semibold text-ink underline underline-offset-4 hover:text-destaque">
          <FilterX aria-hidden="true" className="size-4" />Limpar filtros ({ativos})
        </button>
      )}
    </section>
  );
}

/** Estado vazio que diz qual filtro limpar. */
export function VazioFiltrado({ total }: { total?: number }) {
  const { filtros, definir, limpar } = useFiltros();
  const { nomeCategoria, nomeOrgao } = useBase();
  const ativos = (Object.keys(ROTULO) as ChaveFiltro[]).filter((k) => filtros[k] && filtros[k] !== "todos");
  const valor = (k: ChaveFiltro, v: string) =>
    k === "categoria" ? nomeCategoria(v) : k === "responsavel" ? nomeOrgao(v) : k === "origem" ? NOME_ORIGEM[v as keyof typeof NOME_ORIGEM] : NOME_STATUS[v as keyof typeof NOME_STATUS];
  return (
    <div className="grid justify-items-start gap-2 rounded-card border-2 border-dashed border-line-strong px-5 py-6">
      <p className="text-base font-semibold">Nenhuma ocorrência com esses filtros{total ? ` (de ${total} no total)` : ""}.</p>
      {ativos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {ativos.map((k) => (
            <button key={k} type="button" onClick={() => definir(k, undefined)}
              className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip px-3 text-sm font-semibold shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/55">
              <FilterX aria-hidden="true" className="size-4" />Tirar “{ROTULO[k]}: {valor(k, filtros[k]!)}”
            </button>
          ))}
          {ativos.length > 1 && (
            <button type="button" onClick={limpar} className="min-h-console cursor-pointer px-2 text-sm font-semibold underline underline-offset-4">Limpar todos</button>
          )}
        </div>
      ) : <p className="text-sm text-ink-muted">Ainda não chegou nenhuma ocorrência aqui.</p>}
    </div>
  );
}

"use client";
// Escolha da categoria pelo cidadão ("Não é isso", confiança baixa, API fora do ar).
// Mais prováveis primeiro, depois todas, com busca. Reaproveitado na F3 (gestor reclassifica).
import { Check, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Categoria, Responsavel } from "@/providers/tipos";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SeletorCategoria({ categorias, provaveis = [], responsaveis = [], selecionada, aoEscolher, titulo = "Qual é o problema?" }: {
  categorias: Categoria[]; provaveis?: Categoria[]; responsaveis?: Responsavel[];
  selecionada?: string | null; aoEscolher: (c: Categoria) => void; titulo?: string;
}) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const nomeResp = (rid: string) => responsaveis.find((r) => r.id === rid)?.nome;
  const idsProvaveis = new Set(provaveis.map((c) => c.id));
  const filtradas = useMemo(() => {
    const b = normalizar(busca.trim());
    const resto = categorias.filter((c) => !idsProvaveis.has(c.id) || b);
    return b ? resto.filter((c) => normalizar(c.nome).includes(b) || c.palavras.some((p) => normalizar(p).includes(b))) : resto;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, categorias, provaveis]);

  const opcao = (c: Categoria) => {
    const marcada = selecionada === c.id;
    return (
      <li key={c.id}>
        <label className={`flex min-h-toque cursor-pointer items-center gap-3 rounded-control px-4 py-2.5 shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/45 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring ${marcada ? "bg-rail-active text-on-rail-active shadow-[inset_0_0_0_2px_var(--qr-destaque)]" : "bg-surface-raised"}`}>
          <input type="radio" name={`${id}-cat`} value={c.id} checked={marcada} onChange={() => aoEscolher(c)} className="sr-only" />
          <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${marcada ? "border-destaque bg-destaque text-primary-foreground" : "border-line-strong"}`}>
            {marcada && <Check className="size-4" strokeWidth={3} />}
          </span>
          <span className="grid">
            <span className="text-[17px] font-semibold">{c.nome}</span>
            {nomeResp(c.responsavel_id) && <span className="text-base text-ink-muted">Quem resolve: {nomeResp(c.responsavel_id)}</span>}
          </span>
        </label>
      </li>
    );
  };

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-xl font-semibold">{titulo}</legend>
      {provaveis.length > 0 && !busca && (
        <div className="grid gap-2">
          <p className="text-base font-semibold text-ink-muted">Mais prováveis</p>
          <ul className="grid gap-2">{provaveis.map(opcao)}</ul>
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-busca`} className="text-base font-semibold text-ink-muted">
          {provaveis.length && !busca ? "Ou procure entre todas" : "Procure ou escolha na lista"}
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-muted" />
          <input id={`${id}-busca`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: lixo, poste, água"
            className="min-h-toque w-full rounded-control border-[1.5px] border-line-strong bg-surface-raised pr-4 pl-11 text-[17px] text-ink placeholder:text-ink-muted" />
        </div>
      </div>
      {filtradas.length
        ? <ul className="grid max-h-[420px] gap-2 overflow-y-auto p-0.5">{filtradas.map(opcao)}</ul>
        : <p className="text-base text-ink-muted">Nada com “{busca}”. Tente outra palavra ou escolha na lista.</p>}
    </fieldset>
  );
}

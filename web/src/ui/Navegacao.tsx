"use client";
// Barra do topo, dock em pílula e trilho de ícones (design system: Navegacao).
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Marca } from "./Marca";

/** `exato`: só fica ativo na rota exata (ex.: "/gestao", que é prefixo das outras telas do console). */
export interface ItemNav { href: string; rotulo: string; icone: LucideIcon; exato?: boolean }

const ativo = (atual: string, { href, exato }: ItemNav) =>
  href === "/" ? atual === "/" || atual.startsWith("/reportar") : exato ? atual === href : atual.startsWith(href);

export function BarraTopo({ inicio = "/", direita }: { inicio?: string; direita?: ReactNode }) {
  return (
    <header className="glass flex h-16 items-center justify-between gap-4 rounded-bar px-5">
      <Link href={inicio} className="rounded-chip"><Marca /></Link>
      <div className="flex items-center gap-2">{direita}</div>
    </header>
  );
}

/** Dock em pílula. No celular, `fixo` vira a navegação principal na base da tela (rótulo sempre visível). */
/** `sufixo`: texto somado ao link (ex.: "?categoria=buraco"), para os filtros acompanharem a troca de tela. */
export function Dock({ itens, rotulo, fixo = false, sufixo = "" }: { itens: ItemNav[]; rotulo: string; fixo?: boolean; sufixo?: string }) {
  const atual = usePathname();
  return (
    <nav aria-label={rotulo}
      className={fixo ? "glass fixed inset-x-3 bottom-3 z-20 flex justify-between gap-1 rounded-pill p-1.5 md:static md:inset-auto md:mx-auto md:w-max" : "glass mx-auto flex w-max gap-1 rounded-pill p-1.5"}>
      {itens.map((item) => {
        const { href, rotulo: r, icone: Icone } = item;
        const a = ativo(atual, item);
        return (
          <Link key={href} href={href + sufixo} aria-current={a ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill px-3 text-[13px] font-medium whitespace-nowrap md:min-h-toque md:flex-row md:gap-2 md:px-[18px] md:text-[15px] ${a ? "bg-rail-active text-on-rail-active shadow-float hc:shadow-none" : "text-ink-muted hover:bg-rail-active/45 hover:text-ink"}`}>
            <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {r}
          </Link>
        );
      })}
    </nav>
  );
}

/** Trilho vertical (só desktop, só ícones: cada um com aria-label e dica). */
export function Trilho({ itens, rotulo, sufixo = "" }: { itens: ItemNav[]; rotulo: string; sufixo?: string }) {
  const atual = usePathname();
  return (
    <nav aria-label={rotulo} className="glass hidden w-max flex-col gap-2 rounded-pill p-1.5 lg:flex">
      {itens.map((item) => {
        const { href, rotulo: r, icone: Icone } = item;
        const a = ativo(atual, item);
        return (
          <Link key={href} href={href + sufixo} aria-label={r} title={r} aria-current={a ? "page" : undefined}
            className={`grid size-12 place-items-center rounded-full ${a ? "bg-rail-active text-on-rail-active shadow-float hc:shadow-none" : "text-ink-muted hover:bg-rail-active/45 hover:text-ink"}`}>
            <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </Link>
        );
      })}
    </nav>
  );
}

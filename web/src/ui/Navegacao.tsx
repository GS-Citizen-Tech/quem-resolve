"use client";
// Navegação (design system: Navegacao, revista em 16/11).
// Cidadão: barra do topo com os links no computador; no celular, barra de baixo (Dock).
// Console: barra lateral com nomes no computador (Trilho); no celular, barra de baixo.
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Marca } from "./Marca";

/** `exato`: só fica ativo na rota exata (ex.: "/gestao", que é prefixo das outras telas do console). */
export interface ItemNav { href: string; rotulo: string; icone: LucideIcon; exato?: boolean }

const ativo = (atual: string, { href, exato }: ItemNav) =>
  href === "/" ? atual === "/" || atual.startsWith("/reportar") : exato ? atual === href : atual.startsWith(href);

/** `itens`: links que aparecem dentro da barra a partir de 768 px (no celular eles ficam no Dock). */
export function BarraTopo({ inicio = "/", direita, itens, rotulo, className = "" }: {
  inicio?: string; direita?: ReactNode; itens?: ItemNav[]; rotulo?: string; className?: string;
}) {
  const atual = usePathname();
  return (
    <header className={`glass flex h-16 items-center justify-between gap-4 rounded-bar pr-3 pl-5 ${className}`}>
      <Link href={inicio} className="rounded-chip"><Marca /></Link>
      {itens && (
        <nav aria-label={rotulo} className="hidden items-center gap-1 md:flex">
          {itens.map((item) => {
            const a = ativo(atual, item);
            return (
              <Link key={item.href} href={item.href} aria-current={a ? "page" : undefined}
                className={`flex min-h-toque items-center rounded-pill px-4 text-base whitespace-nowrap ${a ? "bg-rail-active font-semibold text-on-rail-active" : "font-medium text-ink-muted hover:bg-rail-active/45 hover:text-ink"}`}>
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="flex items-center gap-1">{direita}</div>
    </header>
  );
}

/** Barra de baixo, só em telas pequenas. `some`: a partir de qual largura ela sai (os links passam para o topo ou a lateral). */
/** `sufixo`: texto somado ao link (ex.: "?categoria=buraco"), para os filtros acompanharem a troca de tela. */
export function Dock({ itens, rotulo, some = "md", sufixo = "" }: { itens: ItemNav[]; rotulo: string; some?: "md" | "lg" | "nunca"; sufixo?: string }) {
  const atual = usePathname();
  const esconde = some === "md" ? "md:hidden" : some === "lg" ? "lg:hidden" : "";
  return (
    <nav aria-label={rotulo}
      className={`glass fixed inset-x-3 bottom-3 z-20 flex justify-between gap-1 rounded-pill p-1.5 ${esconde}`}>
      {itens.map((item) => {
        const { href, rotulo: r, icone: Icone } = item;
        const a = ativo(atual, item);
        return (
          <Link key={href} href={href + sufixo} aria-current={a ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill px-2 text-[13px] whitespace-nowrap ${a ? "bg-rail-active font-semibold text-on-rail-active shadow-float hc:shadow-none" : "font-medium text-ink-muted hover:bg-rail-active/45 hover:text-ink"}`}>
            <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {r}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navegação lateral do console (computador): ícone e nome, uma linha por tela. */
export function Trilho({ itens, rotulo, sufixo = "" }: { itens: ItemNav[]; rotulo: string; sufixo?: string }) {
  const atual = usePathname();
  return (
    <nav aria-label={rotulo} className="grid gap-0.5">
      {itens.map((item) => {
        const { href, rotulo: r, icone: Icone } = item;
        const a = ativo(atual, item);
        return (
          <Link key={href} href={href + sufixo} aria-current={a ? "page" : undefined}
            className={`flex min-h-10 items-center gap-2.5 rounded-chip px-2.5 text-[15px] ${a ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-ink-muted hover:bg-rail-active/55 hover:text-ink"}`}>
            <Icone aria-hidden="true" className="size-[18px]" strokeWidth={a ? 2 : 1.75} />
            {r}
          </Link>
        );
      })}
    </nav>
  );
}

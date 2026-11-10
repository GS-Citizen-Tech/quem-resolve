// Material de vidro: Painel (glass, painel principal) e CartaoVidro (glass-card, dentro do painel).
// Pilha fixa do design system: foto → scrim → glass → glass-card. Não reduza a opacidade.
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export function Painel({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "main" }) {
  return <Tag className={`glass rounded-panel p-6 md:p-8 ${className}`}>{children}</Tag>;
}

export function CartaoVidro({ rotulo, icone: Icone, titulo, children, indice, className = "" }: {
  rotulo?: string; icone?: LucideIcon; titulo?: string; children?: ReactNode; indice?: number; className?: string;
}) {
  const animado = indice !== undefined;
  return (
    <section className={`glass-card rounded-card p-5 ${animado ? "entrada" : ""} ${className}`}
      style={animado ? ({ "--i": indice } as CSSProperties) : undefined}>
      {rotulo && (
        <p className="mb-1 flex items-center gap-2 text-base text-ink-muted">
          {Icone && <Icone aria-hidden="true" className="size-5 text-destaque" strokeWidth={1.75} />}
          {rotulo}
        </p>
      )}
      {titulo && <h2 className="text-xl leading-[26px] font-semibold tracking-[-0.015em]">{titulo}</h2>}
      {children}
    </section>
  );
}

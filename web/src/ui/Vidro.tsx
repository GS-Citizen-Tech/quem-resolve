// Material de vidro: Painel (glass, painel principal) e CartaoVidro (glass-card, dentro do painel).
// Pilha fixa do design system: foto → scrim → glass → glass-card. Não reduza a opacidade.
import type { CSSProperties, ReactNode } from "react";

export function Painel({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "main" }) {
  return <Tag className={`glass rounded-panel p-6 md:p-8 ${className}`}>{children}</Tag>;
}

export function CartaoVidro({ rotulo, titulo, children, indice, className = "", comoTitulo }: {
  rotulo?: string; titulo?: string;
  /** O título do cartão é o título da tela (h1, maior). */
  comoTitulo?: boolean; children?: ReactNode; indice?: number; className?: string;
}) {
  const animado = indice !== undefined;
  return (
    <section className={`glass-card rounded-card p-5 ${animado ? "entrada" : ""} ${className}`}
      style={animado ? ({ "--i": indice } as CSSProperties) : undefined}>
      {rotulo && (
        <p className="mb-1 text-base text-ink-muted">{rotulo}</p>
      )}
      {titulo && (comoTitulo
        ? <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.025em]">{titulo}</h1>
        : <h2 className="text-xl leading-[26px] font-semibold tracking-[-0.015em]">{titulo}</h2>)}
      {children}
    </section>
  );
}

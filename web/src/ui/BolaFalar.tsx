"use client";
// Bola de falar: o jeito mais rápido de reportar. Grande na tela inicial, média no cartão "O que você viu".
// É um <button> de verdade (teclado, leitor de tela), com o texto sempre escrito embaixo (não depende só do ícone).
import { Camera, Mic, Square } from "lucide-react";
import Link from "next/link";

type Tamanho = "grande" | "media";
const DIM: Record<Tamanho, { bola: string; icone: string; texto: string }> = {
  grande: { bola: "size-40", icone: "size-16", texto: "text-xl" },
  media: { bola: "size-20", icone: "size-9", texto: "text-[17px]" },
};
const visual = "relative grid place-items-center rounded-full bg-primary text-primary-foreground shadow-glass transition hover:bg-brand-hover active:scale-[.97] hc:outline-3 hc:outline-ink";

export function BolaFalar({ tamanho = "grande", ouvindo = false, rotulo, dica, aoTocar, href }: {
  tamanho?: Tamanho;
  ouvindo?: boolean;
  /** Texto embaixo da bola (também é o nome acessível). */
  rotulo: string;
  dica?: string;
  aoTocar?: () => void;
  /** Sem ditado no navegador: vira um link para o Reportar com ícone de câmera. */
  href?: string;
}) {
  const d = DIM[tamanho];
  const Icone = href ? Camera : ouvindo ? Square : Mic;
  const bola = <Icone aria-hidden="true" className={d.icone} strokeWidth={ouvindo ? 2.5 : 1.75} fill={ouvindo ? "currentColor" : "none"} />;
  // O anel só pulsa enquanto ouve. Parada, a bola é sólida com sombra suave.
  const pulsando = ouvindo;
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <span className={`relative isolate rounded-full ${pulsando ? "pulso" : ""}`}>
        {href ? (
          <Link href={href} aria-label={rotulo} className={`${visual} ${d.bola}`}>{bola}</Link>
        ) : (
          <button type="button" onClick={aoTocar} aria-label={rotulo} aria-pressed={ouvindo}
            className={`${visual} ${d.bola} cursor-pointer ${ouvindo ? "bg-danger! text-on-emergency!" : ""}`}>{bola}</button>
        )}
      </span>
      <span aria-hidden="true" className="grid gap-0.5">
        <span className={`${d.texto} font-semibold`}>{rotulo}</span>
        {dica && <span className="text-base text-ink-muted">{dica}</span>}
      </span>
    </div>
  );
}

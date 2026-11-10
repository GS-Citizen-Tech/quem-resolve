// Botões do design system: primário, secundário, link e emergência (sempre sólido).
// Não usamos botão desabilitado: o botão fica ativo e a tela explica o que falta.
import type { LucideIcon } from "lucide-react";
import { Phone } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "link";
type Tamanho = "cidadao" | "console";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] leading-tight transition active:translate-y-px cursor-pointer";
const variantes: Record<Variante, string> = {
  primario: "bg-primary text-primary-foreground hover:bg-brand-hover hc:outline-2 hc:outline-ink hc:-outline-offset-2",
  secundario: "bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/55",
  link: "bg-transparent text-ink underline underline-offset-4 hover:text-destaque",
};
const tamanhos: Record<Tamanho, string> = {
  cidadao: "min-h-toque px-[22px] rounded-control text-[17px]",
  console: "min-h-console px-3.5 rounded-chip text-sm",
};

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: LucideIcon;
  bloco?: boolean;
}

export function Botao({ variante = "primario", tamanho = "cidadao", icone: Icone, bloco, className = "", children, type = "button", ...p }: BotaoProps) {
  return (
    <button type={type} {...p}
      className={`${base} ${variantes[variante]} ${variante === "link" ? "min-h-toque px-1" : tamanhos[tamanho]} ${bloco ? "w-full" : ""} ${className}`}>
      {Icone && <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />}
      {children}
    </button>
  );
}

/** "Ligar 193 · Bombeiros": sólido, 64px, sempre com telefone e número escritos. */
export function BotaoEmergencia({ numero, nome, bloco = true }: { numero: string; nome: string; bloco?: boolean }) {
  return (
    <a href={`tel:${numero}`}
      className={`inline-flex min-h-emergencia items-center justify-center gap-3 rounded-control bg-emergency px-[26px] text-xl font-bold text-on-emergency hover:brightness-90 hc:shadow-[inset_0_0_0_3px_#fff] ${bloco ? "w-full" : ""}`}>
      <Phone aria-hidden="true" className="size-6" strokeWidth={2.25} />
      Ligar {numero} · {nome}
    </a>
  );
}

/** Mesmo visual do Botao, mas navega (next/link). */
export function BotaoLink({ href, variante = "primario", tamanho = "cidadao", icone: Icone, bloco, className = "", children }: {
  href: string; variante?: Variante; tamanho?: Tamanho; icone?: LucideIcon; bloco?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variantes[variante]} ${tamanhos[tamanho]} ${bloco ? "w-full" : ""} ${className}`}>
      {Icone && <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />}
      {children}
    </Link>
  );
}

"use client";
// Balões da conversa e fontes citadas. Usados no chat e na voz; na F3, no "porquê" da IA do console.
import { BookOpen, ExternalLink, Mic } from "lucide-react";
import type { ReactNode } from "react";
import type { Fonte } from "@/providers/tipos";

export function Balao({ de, children, via, rodape }: { de: "cidadao" | "assistente"; children: ReactNode; via?: "texto" | "voz"; rodape?: ReactNode }) {
  const meu = de === "cidadao";
  return (
    <li className={`grid gap-2 ${meu ? "justify-items-end" : "justify-items-start"}`}>
      <p className="sr-only">{meu ? "Você disse:" : "Assistente:"}</p>
      <div className={`grid max-w-[92%] gap-2 rounded-card px-4 py-3 text-[17px] leading-7 ${meu
        ? "rounded-br-[6px] bg-primary text-primary-foreground hc:outline-2 hc:outline-ink"
        : "glass-card rounded-bl-[6px]"}`}>
        {via === "voz" && meu && (
          <span className="flex items-center gap-1.5 text-base opacity-85"><Mic aria-hidden="true" className="size-4" />Por voz</span>
        )}
        {children}
      </div>
      {rodape}
    </li>
  );
}

export function FontesCitadas({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <div className="grid gap-1.5 border-t border-line-strong/40 pt-2">
      <p className="flex items-center gap-1.5 text-base font-semibold text-ink-muted">
        <BookOpen aria-hidden="true" className="size-[18px] text-destaque" />Fontes
      </p>
      <ul className="grid gap-1">
        {fontes.map((f, i) => (
          <li key={i} className="text-base">
            {f.trecho ? (
              <details>
                <summary className="min-h-toque cursor-pointer py-2.5 font-semibold">
                  {f.titulo} <span className="font-normal text-ink-muted">(ver trecho)</span>
                </summary>
                <blockquote className="mb-1 border-l-[3px] border-destaque pl-3 text-ink-muted">“{f.trecho}”</blockquote>
                {f.url && <LinkFonte url={f.url} />}
              </details>
            ) : (
              <span className="flex flex-wrap items-center gap-x-2">{f.titulo}{f.url && <LinkFonte url={f.url} />}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkFonte({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-toque items-center gap-1.5 font-semibold underline underline-offset-4 hover:text-destaque">
      <ExternalLink aria-hidden="true" className="size-4" />Abrir fonte<span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

"use client";
// Moldura do app do cidadão: barra do topo de vidro + dock (Reportar · Tirar dúvida · Meus reportes).
import { Camera, ListChecks, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarraTopo, Dock, type ItemNav } from "@/ui/Navegacao";
import { SeletorTema } from "@/ui/SeletorTema";

const ITENS: ItemNav[] = [
  { href: "/", rotulo: "Reportar", icone: Camera },
  { href: "/assistente", rotulo: "Tirar dúvida", icone: MessageCircleQuestion },
  { href: "/meus-reportes", rotulo: "Meus reportes", icone: ListChecks },
];

export function LayoutCidadao({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-4 px-4 pt-4 pb-28 md:pb-6">
      <BarraTopo direita={<>
        <SeletorTema />
        <Link href="/gestao" className="hidden rounded-chip px-2 py-3 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline sm:block">
          Sou servidor público
        </Link>
      </>} />
      <main id="conteudo" className="flex-1">{children}</main>
      <Dock itens={ITENS} rotulo="Navegação do app" fixo />
    </div>
  );
}

"use client";
// Moldura do app do cidadão: barra do topo de vidro + dock (Reportar · Tirar dúvida · Meus reportes).
import { Camera, ListChecks, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarraTopo, Dock, type ItemNav } from "@/ui/Navegacao";
import { SeletorTema } from "@/ui/SeletorTema";
import { AlertaSom, BotaoAvisosSom } from "@/ui/AlertaSom";

const ITENS: ItemNav[] = [
  { href: "/", rotulo: "Reportar", icone: Camera },
  { href: "/assistente", rotulo: "Tirar dúvida", icone: MessageCircleQuestion },
  { href: "/meus-reportes", rotulo: "Meus reportes", icone: ListChecks },
];

export function LayoutCidadao({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-4xl flex-col gap-4 px-4 pt-4 pb-28 md:pb-6">
      <BarraTopo itens={ITENS} rotulo="Navegação do app" direita={<>
        <BotaoAvisosSom />
        <SeletorTema />
      </>} />
      <AlertaSom />
      <main id="conteudo" className="flex-1">{children}</main>
      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-2 pt-2 text-sm text-ink-muted">
        <span>Projeto acadêmico · FIAP 2026</span>
        <Link href="/privacidade" className="rounded-chip py-2 font-medium underline underline-offset-4 hover:text-ink">Privacidade</Link>
        <Link href="/gestao" className="rounded-chip py-2 font-medium underline underline-offset-4 hover:text-ink">Sou servidor público</Link>
      </footer>
      <Dock itens={ITENS} rotulo="Navegação do app" />
    </div>
  );
}

"use client";
// "Sair rápido" (violência doméstica): troca o app por uma busca neutra, sem som,
// e apaga o rascunho e a conversa deste aparelho. Também funciona com a tecla Esc.
// A página do app é substituída (location.replace), então o "voltar" não cai nesta tela.
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { apagarRastros } from "@/state/AppState";

export const DESTINO_NEUTRO = "https://www.google.com/search?q=previs%C3%A3o+do+tempo";

export function sairRapido() {
  apagarRastros();
  window.location.replace(DESTINO_NEUTRO);
}

export function SaidaRapida() {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") sairRapido(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  return (
    <button type="button" onClick={sairRapido}
      className="sticky top-3 z-50 inline-flex justify-self-end min-h-toque cursor-pointer items-center gap-2 rounded-pill bg-surface-raised px-5 text-[17px] font-semibold text-ink shadow-float hover:bg-rail-active hc:border-2 hc:border-line-strong">
      <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
      Sair rápido
    </button>
  );
}

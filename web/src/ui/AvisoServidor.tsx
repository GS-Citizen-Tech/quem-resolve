"use client";
// Aviso discreto enquanto a API "acorda" (Render grátis dorme depois de 15 min sem uso). Some sozinho quando ela responde.
import { LoaderCircle } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { acordarServidor, servidor } from "@/providers/api";

export function AvisoServidor() {
  const estado = useSyncExternalStore(servidor.ouvir, servidor.estado, () => "desconhecido" as const);
  useEffect(() => { acordarServidor(); }, []); // já na abertura do site, antes da 1ª tela pedir dados
  if (estado !== "acordando") return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[900] flex justify-center px-4 md:bottom-6">
      <p className="flex max-w-md items-center gap-2.5 rounded-pill border border-line-strong bg-surface-raised px-4 py-2.5 text-base text-ink shadow-glass">
        <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
        Ligando o servidor. Na primeira visita pode levar até 1 minuto.
      </p>
    </div>
  );
}

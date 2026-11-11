"use client";
// "Falar": consentimento na primeira vez, depois tocar para falar e tocar para enviar (até 60 s).
import { Mic, Square } from "lucide-react";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import type { FaseGravacao } from "@/ui/useVoz";

export function PainelVoz({ consentiu, aoConsentir, aoRecusar, fase, segundos, suportado, enviando, aoIniciar, aoParar, destacado }: {
  consentiu: boolean; aoConsentir: () => void; aoRecusar: () => void;
  fase: FaseGravacao; segundos: number; suportado: boolean | null; enviando: boolean;
  aoIniciar: () => void; aoParar: () => void; destacado: boolean;
}) {
  if (suportado === false || fase === "sem_suporte") {
    return <Aviso tipo="info" titulo="Este navegador não grava áudio">Você pode digitar a pergunta abaixo. No celular, o teclado também tem microfone.</Aviso>;
  }
  if (!consentiu) {
    return (
      <div className="grid gap-3 rounded-card bg-info-soft p-4 hc:border-2 hc:border-line-strong">
        <p className="font-semibold text-info">Antes de falar</p>
        <p>Sua voz vai para o nosso servidor, vira texto e o áudio é apagado logo em seguida. Nada fica gravado.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Botao icone={Mic} onClick={aoConsentir}>Entendi, quero falar</Botao>
          <Botao variante="secundario" onClick={aoRecusar}>Prefiro digitar</Botao>
        </div>
      </div>
    );
  }
  const gravando = fase === "gravando";
  return (
    <div className="grid justify-items-center gap-2">
      <button type="button" onClick={gravando ? aoParar : aoIniciar} aria-pressed={gravando}
        aria-label={gravando ? "Parar e enviar" : "Tocar para falar"}
        className={`grid size-24 cursor-pointer place-items-center rounded-full shadow-float transition ${gravando
          ? "bg-danger text-on-emergency" : "bg-primary text-primary-foreground hover:bg-brand-hover"} ${destacado && !gravando ? "ring-4 ring-destaque/40" : ""} hc:outline-2 hc:outline-ink`}>
        {gravando ? <Square aria-hidden="true" className="size-9" fill="currentColor" /> : <Mic aria-hidden="true" className="size-10" />}
      </button>
      <p role="status" aria-live="polite" className="text-center font-semibold">
        {enviando ? "Entendendo o que você disse…"
          : fase === "pedindo" ? "Liberando o microfone…"
          : gravando ? `Ouvindo… ${segundos}s de 60s. Toque para enviar.`
          : "Toque para falar"}
      </p>
      {fase === "negado" && (
        <Aviso tipo="warn" titulo="O microfone não foi liberado">
          Libere o microfone no cadeado ao lado do endereço do site, ou digite a pergunta abaixo.
        </Aviso>
      )}
    </div>
  );
}

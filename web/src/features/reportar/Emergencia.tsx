"use client";
// Etapa 3a · Emergência (guardrail nível 1 ou 2), versão básica. Nada é guardado.
// A versão completa (saída rápida discreta etc.) entra na F2.
import { Phone } from "lucide-react";
import { BotaoEmergencia, Botao } from "@/ui/Botao";
import type { GuardrailResultado } from "@/providers/tipos";

export function Emergencia({ guardrail, aoContinuar }: { guardrail: GuardrailResultado; aoContinuar: () => void }) {
  const { nivel, canal_principal, outros_canais } = guardrail;
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.025em]">
          {nivel === 1 ? "Isso parece uma emergência" : "Isso precisa de ajuda especializada"}
        </h1>
        <p className="text-[18px] leading-7">
          {nivel === 1
            ? "Não espere: ligue agora. O Quem Resolve? não atende emergências."
            : "Existe um canal certo e sigiloso para isso. A ligação é gratuita."}
        </p>
      </div>
      {canal_principal && (
        <div className="grid gap-2">
          <BotaoEmergencia numero={canal_principal.numero} nome={canal_principal.nome} />
          <p className="text-base text-ink-muted">{canal_principal.quando}</p>
        </div>
      )}
      {outros_canais.length > 0 && (
        <div className="grid gap-2">
          <p className="font-semibold">Outros canais</p>
          <ul className="grid gap-2">
            {outros_canais.map((c) => (
              <li key={c.numero}>
                <a href={`tel:${c.numero}`} className="flex min-h-toque items-center gap-3 rounded-control px-4 py-2 shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/45">
                  <Phone aria-hidden="true" className="size-5 shrink-0 text-destaque" />
                  <span><strong>{c.numero} · {c.nome}</strong><span className="block text-base text-ink-muted">{c.quando}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Botao variante="link" onClick={aoContinuar}>Não é uma emergência, continuar</Botao>
    </div>
  );
}

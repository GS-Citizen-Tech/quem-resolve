"use client";
// Tela de emergência (guardrail nível 1 ou 2). Usada no reporte, no chat e na voz.
// Nada é guardado. Em violência doméstica (`saida_rapida`) mostra o "Sair rápido".
import { Phone } from "lucide-react";
import { Botao, BotaoEmergencia } from "./Botao";
import { SaidaRapida } from "./SaidaRapida";
import type { GuardrailResultado } from "@/providers/tipos";

export function TelaEmergencia({ guardrail, aoContinuar, rotuloContinuar = "Não é uma emergência, continuar" }: {
  guardrail: GuardrailResultado; aoContinuar?: () => void; rotuloContinuar?: string;
}) {
  const { nivel, canal_principal, outros_canais, saida_rapida } = guardrail;
  return (
    <div className="grid gap-5">
      {saida_rapida && <SaidaRapida />}
      <div className="grid gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.025em]">
          {nivel === 1 ? "Isso parece uma emergência" : saida_rapida ? "Você não está sozinha nem sozinho" : "Isso precisa de ajuda especializada"}
        </h1>
        <p className="text-[18px] leading-7">
          {nivel === 1
            ? "Não espere: ligue agora. O Quem Resolve? não atende emergências."
            : saida_rapida
              ? "A Central de Atendimento à Mulher atende 24 horas, de graça e em sigilo. Se houver perigo agora, ligue 190."
              : "Existe um canal certo e sigiloso para isso. A ligação é gratuita."}
        </p>
        {saida_rapida && <p className="text-base text-ink-muted">Se alguém chegar, toque em “Sair rápido” ou aperte Esc: esta tela some e a conversa é apagada deste aparelho.</p>}
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
      {aoContinuar && <Botao variante="link" onClick={aoContinuar}>{rotuloContinuar}</Botao>}
    </div>
  );
}

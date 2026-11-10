// Tela de início do cidadão: uma ação principal (Reportar), sem cadastro.
import { Camera, Mic, MessageCircleQuestion } from "lucide-react";
import { BotaoLink } from "@/ui/Botao";
import { Painel } from "@/ui/Vidro";

export function Inicio() {
  return (
    <Painel className="entrada grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-[36px] leading-[42px] font-medium tracking-[-0.03em]">Viu um problema na rua?</h1>
        <p className="text-[18px] leading-7 text-ink-muted">
          Tire uma foto ou conte o que é. A gente diz quem resolve, por qual canal e o que fazer. Não precisa de cadastro.
        </p>
      </div>
      <div className="grid gap-3">
        <BotaoLink href="/reportar" icone={Camera} bloco className="min-h-16! text-xl!">Reportar problema</BotaoLink>
        <div className="grid gap-3 sm:grid-cols-2">
          <BotaoLink href="/assistente" variante="secundario" icone={MessageCircleQuestion} bloco>Tenho uma dúvida</BotaoLink>
          <BotaoLink href="/reportar?voz=1" variante="secundario" icone={Mic} bloco>Falar</BotaoLink>
        </div>
      </div>
    </Painel>
  );
}

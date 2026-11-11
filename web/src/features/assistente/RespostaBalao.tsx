"use client";
// Conteúdo de uma resposta do assistente: texto, avisos (sem fonte, fora do tema, risco), fontes, ouvir e "Isso ajudou?".
import { Timer, Volume2, VolumeX } from "lucide-react";
import { api } from "@/providers/api";
import type { RespostaAssistente } from "@/providers/tipos";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoEmergencia } from "@/ui/Botao";
import { FontesCitadas } from "@/ui/Conversa";
import { Feedback } from "@/ui/Feedback";

const segundos = (ms: number) => ms < 1000
  ? `${Math.max(1, Math.round(ms))} ms`
  : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;

export function RespostaBalao({ r }: { r: RespostaAssistente }) {
  const g = r.guardrail;
  return (
    <>
      {g?.nivel === 3 && g.canal_principal && (
        <div className="grid gap-2">
          <Aviso tipo="warn" titulo="Atenção: pode haver risco">Fique longe do local. Se houver perigo agora, ligue {g.canal_principal.numero}.</Aviso>
          <BotaoEmergencia numero={g.canal_principal.numero} nome={g.canal_principal.nome} />
        </div>
      )}
      <p className="whitespace-pre-line">{r.resposta}</p>
      {r.sem_fonte && !r.fora_do_tema && (
        <Aviso tipo="info" titulo="Não achei isso nas fontes oficiais">
          Para ter certeza, ligue <a href="tel:156" className="font-semibold underline underline-offset-4">156</a> (SP156, da Prefeitura).
        </Aviso>
      )}
      {r.fora_do_tema && <p className="text-base text-ink-muted">Eu só respondo sobre problemas de rua e serviços da cidade.</p>}
      <FontesCitadas fontes={r.fontes} />
    </>
  );
}

export function RodapeResposta({ r, ultima, latenciaMs, fala }: {
  r: RespostaAssistente; ultima: boolean; latenciaMs?: number;
  fala: { suportado: boolean; falando: boolean; falar: (t: string) => void; parar: () => void };
}) {
  return (
    <div className="grid w-full max-w-[92%] gap-2">
      <div className="flex flex-wrap items-center gap-x-4">
        {fala.suportado && (
          <Botao variante="link" icone={fala.falando ? VolumeX : Volume2} onClick={() => (fala.falando ? fala.parar() : fala.falar(r.resposta))}>
            {fala.falando ? "Parar" : "Ouvir"}
          </Botao>
        )}
        {latenciaMs !== undefined && (
          <span className="flex items-center gap-1.5 text-base text-ink-muted"><Timer aria-hidden="true" className="size-4" />Respondeu em {segundos(latenciaMs)}</span>
        )}
      </div>
      {ultima && !r.fora_do_tema && r.modelo !== "guardrail" && (
        <Feedback key={r.id} enviar={(util, comentario) => api.feedback({ alvo: "assistente", id: r.id, util, comentario })} />
      )}
    </div>
  );
}

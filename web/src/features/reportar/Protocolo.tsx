"use client";
// Etapa 6 · Protocolo: número, o que acontece agora e "Isso ajudou?".
import { ListChecks, Plus } from "lucide-react";
import { api } from "@/providers/api";
import type { Categoria, Ocorrencia, Responsavel } from "@/providers/tipos";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoLink } from "@/ui/Botao";
import { Feedback } from "@/ui/Feedback";
import { CartaoVidro } from "@/ui/Vidro";

export function Protocolo({ ocorrencia, categoria, responsavel, aoNovo }: {
  ocorrencia: Ocorrencia; categoria: Categoria | null; responsavel: Responsavel | null; aoNovo: () => void;
}) {
  return (
    <div className="grid gap-5">
      <Aviso tipo="ok" titulo="Solicitação gerada">Guarde o número abaixo para acompanhar.</Aviso>
      <div className="grid gap-1 text-center">
        <p className="text-ink-muted">Protocolo</p>
        <p className="font-mono text-[28px] font-medium tracking-wide break-all select-all">{ocorrencia.protocolo}</p>
        {categoria && <p className="font-semibold">{categoria.nome}</p>}
      </div>
      {ocorrencia.grupo_duplicata_id && (
        <Aviso tipo="info" titulo="Outras pessoas já reportaram isso">
          Juntamos com os reportes de perto daqui. Isso ajuda a priorizar.
        </Aviso>
      )}
      <CartaoVidro titulo="O que acontece agora">
        <ol className="mt-3 grid list-decimal gap-2 pl-6">
          <li>A solicitação é enviada para {responsavel ? <strong>{responsavel.nome}</strong> : "o órgão responsável"}.</li>
          <li>Você acompanha o andamento em <strong>Meus reportes</strong>, neste aparelho.</li>
          <li>Se o problema piorar ou virar perigo, ligue 193 (Bombeiros) ou 199 (Defesa Civil).</li>
        </ol>
      </CartaoVidro>
      <Feedback enviar={(util, comentario) => api.feedback({ alvo: "reporte", id: ocorrencia.id, util, comentario })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <BotaoLink href="/meus-reportes" icone={ListChecks} bloco>Ver meus reportes</BotaoLink>
        <Botao variante="secundario" icone={Plus} bloco onClick={aoNovo}>Reportar outro problema</Botao>
      </div>
    </div>
  );
}

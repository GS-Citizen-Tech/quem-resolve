"use client";
// "Isso ajudou? Sim / Não" (HITL do cidadão). Reaproveitado na F2 (assistente e voz).
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Aviso } from "./Aviso";
import { Botao } from "./Botao";
import { CampoTexto } from "./CampoTexto";

type Fase = "pergunta" | "comentario" | "enviando" | "obrigado" | "erro";

export function Feedback({ enviar, pergunta = "Isso ajudou?" }: { enviar: (util: boolean, comentario?: string) => Promise<unknown>; pergunta?: string }) {
  const [fase, setFase] = useState<Fase>("pergunta");
  const [comentario, setComentario] = useState("");
  const [util, setUtil] = useState<boolean | null>(null);

  const mandar = async (u: boolean, c?: string) => {
    setFase("enviando");
    try { await enviar(u, c?.trim() || undefined); setFase("obrigado"); } catch { setFase("erro"); }
  };

  if (fase === "obrigado") return <Aviso tipo="ok" titulo="Obrigado pela resposta!">{util ? "Que bom que ajudou." : "Vamos usar isso para melhorar."}</Aviso>;
  if (fase === "erro") return <Aviso tipo="info" titulo="Não deu para registrar agora">Sem problema, sua solicitação já está feita.</Aviso>;

  return (
    <div className="grid gap-3" aria-busy={fase === "enviando"}>
      <p className="text-[17px] font-semibold">{pergunta}</p>
      {fase === "comentario" ? (
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); mandar(false, comentario); }}>
          <CampoTexto id="feedback-comentario" multilinha rotulo="O que faltou? (opcional)" maxLength={300}
            value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <Botao type="submit" variante="secundario">Enviar</Botao>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Botao variante="secundario" icone={ThumbsUp} onClick={() => { setUtil(true); mandar(true); }}>Sim</Botao>
          <Botao variante="secundario" icone={ThumbsDown} onClick={() => { setUtil(false); setFase("comentario"); }}>Não</Botao>
        </div>
      )}
    </div>
  );
}

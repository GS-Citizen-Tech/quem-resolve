"use client";
// Etapa 5 · Confirmação: o cidadão vê exatamente o que vai ser enviado antes de gerar.
import { Building2, Camera, FileText, MapPin, RotateCcw, Send, Tag } from "lucide-react";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { ResumoSolicitacao } from "@/ui/ResumoSolicitacao";
import type { Categoria, Responsavel } from "@/providers/tipos";
import type { Rascunho } from "./rascunho";

export function Confirmacao({ r, categoria, responsavel, temFoto, enviando, erro, aoConfirmar }: {
  r: Rascunho; categoria: Categoria; responsavel: Responsavel | null; temFoto: boolean;
  enviando: boolean; erro: string | null; aoConfirmar: () => void;
}) {
  const local = r.local
    ? `Sua localização${r.referencia ? ` · ${r.referencia}` : ""}`
    : `${r.referencia || "Não informado"} (sem localização do aparelho)`;
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Confira antes de enviar</h1>
        <p className="text-ink-muted">É isto que vai na solicitação.</p>
      </div>
      <ResumoSolicitacao itens={[
        { rotulo: "Problema", valor: categoria.nome, icone: Tag },
        { rotulo: "Quem resolve", valor: responsavel ? `${responsavel.nome} · ${responsavel.canal}` : "A confirmar", icone: Building2 },
        { rotulo: "Local", valor: local, icone: MapPin },
        { rotulo: "Descrição", valor: r.descricao, icone: FileText },
        { rotulo: "Foto", valor: temFoto ? "Usada só para identificar o problema (não é guardada)" : "Sem foto", icone: Camera },
      ]} />
      <Aviso tipo="info" titulo="Envio simulado">
        Nesta versão de demonstração a solicitação vai para uma caixa de teste, não para o órgão.
        {responsavel?.url ? " Para o pedido oficial, use o canal direto: " : ""}
        {responsavel?.url && <a href={responsavel.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">{responsavel.canal}<span className="sr-only"> (abre em nova aba)</span></a>}
      </Aviso>
      {erro && (
        <Aviso tipo="danger" titulo="Não consegui gerar a solicitação">
          {erro} Seus dados continuam aqui. {responsavel ? `Se preferir, fale direto com ${responsavel.canal}${/^\d+$/.test(responsavel.contato) ? ` (${responsavel.contato})` : ""}.` : ""}
        </Aviso>
      )}
      <Botao icone={erro ? RotateCcw : Send} bloco className="min-h-16! text-xl!" onClick={aoConfirmar} aria-busy={enviando}>
        {enviando ? "Gerando solicitação…" : erro ? "Tentar de novo" : "Confirmar e gerar solicitação"}
      </Botao>
    </div>
  );
}

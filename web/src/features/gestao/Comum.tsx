"use client";
// Peças comuns das telas do console: cabeçalho com "Atualizar" e aviso de API fora do ar.
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { ErroAPI } from "@/providers/api";
import { Aviso } from "@/ui/Aviso";

export const BOTAO_CONSOLE = "inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip border border-line-strong bg-surface-raised px-3 text-sm font-semibold text-ink hover:border-ink";

export function BotaoAtualizar({ atualizar, carregando }: { atualizar: () => void; carregando?: boolean }) {
  return (
    <button type="button" onClick={atualizar} aria-busy={carregando || undefined} className={BOTAO_CONSOLE}>
      <RefreshCw aria-hidden="true" className={`size-4 ${carregando ? "animate-spin motion-reduce:animate-none" : ""}`} />
      {carregando ? "Atualizando…" : "Atualizar"}
    </button>
  );
}

export function CabecalhoTela({ titulo, descricao, atualizar, carregando, children, acoes }: {
  titulo: string; descricao?: string; atualizar?: () => void; carregando?: boolean; children?: ReactNode;
  /** Botões da tela, à esquerda do "Atualizar". */
  acoes?: ReactNode;
}) {
  return (
    <header className="grid gap-3 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.025em]">{titulo}</h1>
          {descricao && <p className="text-sm text-ink-muted">{descricao}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {acoes}
          {atualizar && <BotaoAtualizar atualizar={atualizar} carregando={carregando} />}
        </div>
      </div>
      {children}
    </header>
  );
}

/** API fora do ar: avisa e oferece "Tentar de novo". O que já estava na tela continua lá. */
export function ErroConsulta({ erro, tentar, temDados }: { erro: ErroAPI; tentar: () => void; temDados: boolean }) {
  return (
    <Aviso tipo="danger" titulo={erro.tipo === "offline" ? "Sem conexão com o servidor" : "Não deu para carregar"}
      acao={<button type="button" onClick={tentar} className="mt-1 inline-flex min-h-console w-max cursor-pointer items-center gap-1.5 rounded-chip bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-brand-hover">
        <RefreshCw aria-hidden="true" className="size-4" />Tentar de novo
      </button>}>
      {erro.tipo === "offline" ? "O servidor não respondeu." : erro.mensagem} {temDados ? "Os números abaixo são da última vez que carregou." : "Seus filtros continuam marcados."}
    </Aviso>
  );
}

"use client";
// Peças comuns das telas do console: cabeçalho com "Atualizar" e aviso de API fora do ar.
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { ErroAPI } from "@/providers/api";
import { Aviso } from "@/ui/Aviso";

export function CabecalhoTela({ titulo, descricao, atualizar, carregando, children }: {
  titulo: string; descricao?: string; atualizar?: () => void; carregando?: boolean; children?: ReactNode;
}) {
  return (
    <header className="glass grid gap-4 rounded-panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-[26px] leading-8 font-medium tracking-[-0.03em]">{titulo}</h1>
          {descricao && <p className="text-sm text-ink-muted">{descricao}</p>}
        </div>
        {atualizar && (
          <button type="button" onClick={atualizar} aria-busy={carregando || undefined}
            className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip px-3 text-sm font-semibold shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/55">
            <RefreshCw aria-hidden="true" className={`size-4 ${carregando ? "animate-spin motion-reduce:animate-none" : ""}`} />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        )}
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
      {erro.tipo === "offline" ? "A API não respondeu." : erro.mensagem} {temDados ? "Os números abaixo são da última vez que carregou." : "Seus filtros continuam marcados."}
    </Aviso>
  );
}

"use client";
// Gaveta lateral (console): abre por cima da tela, à direita, sem trocar de página. No celular ocupa a tela toda.
// <dialog> nativo com showModal: prende o foco, fecha com Esc e devolve o foco a quem abriu.
// Sem portal de propósito: fica dentro do .console e herda as cores sólidas do console.
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Gaveta({ aberta, titulo, subtitulo, aoFechar, children }: {
  aberta: boolean; titulo: string; subtitulo?: ReactNode; aoFechar: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog ref={ref} onClose={aoFechar} aria-labelledby={`${id}-t`}
      // clique no fundo escuro (fora do painel) fecha
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
      className="qr-gaveta m-0 ml-auto h-dvh max-h-none w-full max-w-none bg-surface-solid p-0 text-ink shadow-glass backdrop:bg-scrim sm:w-[min(600px,100vw)] hc:border-l-2 hc:border-line-strong">
      {aberta && (
        <div className="grid min-h-full grid-rows-[auto_1fr]">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--qr-linha,var(--border))] bg-surface-solid px-5 py-4">
            <div className="grid gap-0.5">
              <h2 id={`${id}-t`} className="text-xl font-semibold tracking-[-0.02em]">{titulo}</h2>
              {subtitulo && <div className="text-[13px] text-ink-muted">{subtitulo}</div>}
            </div>
            <button type="button" onClick={aoFechar} aria-label="Fechar" autoFocus
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-chip border border-line-strong bg-surface-raised hover:border-ink">
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

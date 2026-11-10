// Estados de latência e vazio (design para latência, exigência 3.5).
import { CircleCheck, Inbox, LoaderCircle } from "lucide-react";

/** Spinner com texto; com `etapas`, mostra a barra de etapas ("olhando a foto → …"). */
export function Carregando({ texto, etapas, atual = 0 }: { texto: string; etapas?: string[]; atual?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3 py-2">
      <p className="flex items-center gap-3 text-[18px]">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-destaque motion-reduce:animate-none" />
        {texto}
      </p>
      {etapas && (
        <ol className="grid gap-1.5" aria-label="Etapas">
          {etapas.map((e, i) => (
            <li key={e} className={`flex items-center gap-2 text-base ${i <= atual ? "text-ink" : "text-ink-muted"}`}>
              {i < atual
                ? <CircleCheck aria-hidden="true" className="size-5 text-ok" />
                : <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border-2 ${i === atual ? "border-destaque" : "border-line-strong"}`} />}
              <span>{e}{i < atual ? " (feito)" : i === atual ? " (agora)" : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-card border-2 border-dashed border-line-strong px-6 py-8 text-center">
      <Inbox aria-hidden="true" className="size-7 text-ink-muted" />
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="text-ink-muted">{texto}</p>}
    </div>
  );
}

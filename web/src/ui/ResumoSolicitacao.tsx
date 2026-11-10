// Resumo do que será enviado, antes de confirmar (human-in-the-loop).
import type { LucideIcon } from "lucide-react";

export function ResumoSolicitacao({ itens }: { itens: { rotulo: string; valor: React.ReactNode; icone: LucideIcon }[] }) {
  return (
    <dl className="grid gap-3">
      {itens.map(({ rotulo, valor, icone: Icone }) => (
        <div key={rotulo} className="grid grid-cols-[28px_1fr] gap-x-2">
          <Icone aria-hidden="true" className="mt-0.5 size-5 text-destaque" strokeWidth={1.75} />
          <dt className="text-base text-ink-muted">{rotulo}</dt>
          <dd className="col-start-2 text-[17px] font-semibold break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

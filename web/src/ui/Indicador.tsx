// Indicador do console: rótulo, número grande e uma nota curta. `tom="danger"` só quando o número pede ação.
import type { LucideIcon } from "lucide-react";

export function Indicador({ rotulo, valor, nota, icone: Icone, tom }: {
  rotulo: string; valor: string; nota?: string;
  /** Ícone só quando o número é um alerta (junto com `tom`): cor nunca sozinha. */
  icone?: LucideIcon; tom?: "danger";
}) {
  return (
    <section className="glass-card grid content-start gap-1 rounded-card px-4 py-3.5">
      <h2 className="text-[13px] font-medium text-ink-muted">{rotulo}</h2>
      <p className={`flex items-center gap-2 text-[30px] leading-9 font-semibold tracking-[-0.025em] tabular-nums ${tom === "danger" ? "text-danger" : ""}`}>
        {Icone && <Icone aria-hidden="true" className="size-6" strokeWidth={2} />}
        {valor}
      </p>
      {nota && <p className="text-xs text-ink-muted">{nota}</p>}
    </section>
  );
}

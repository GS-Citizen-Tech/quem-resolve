// Indicador do console (design system: kpi 36–40px, peso 500, números tabulares; rótulo 14px; nota em caption 12px).
import type { LucideIcon } from "lucide-react";

export function Indicador({ rotulo, valor, nota, icone: Icone }: { rotulo: string; valor: string; nota?: string; icone?: LucideIcon }) {
  return (
    <section className="glass-card grid content-start gap-1 rounded-card p-4">
      <h2 className="flex items-center gap-1.5 text-sm text-ink-muted">
        {Icone && <Icone aria-hidden="true" className="size-4 text-destaque" strokeWidth={1.75} />}
        {rotulo}
      </h2>
      <p className="text-[36px] leading-[40px] font-medium tracking-[-0.03em] tabular-nums lg:text-[40px] lg:leading-[44px]">{valor}</p>
      {nota && <p className="text-xs text-ink-muted">{nota}</p>}
    </section>
  );
}

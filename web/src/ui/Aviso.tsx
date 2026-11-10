// Mensagem de estado: título curto + uma frase com o que fazer. Ícone fixo por tipo.
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type Tipo = "ok" | "info" | "warn" | "danger";
const cfg = {
  ok: { icone: CircleCheck, fundo: "bg-ok-soft", cor: "text-ok" },
  info: { icone: Info, fundo: "bg-info-soft", cor: "text-info" },
  warn: { icone: TriangleAlert, fundo: "bg-warn-soft", cor: "text-warn" },
  danger: { icone: OctagonAlert, fundo: "bg-danger-soft", cor: "text-danger" },
};

export function Aviso({ tipo, titulo, children, acao }: { tipo: Tipo; titulo: string; children?: ReactNode; acao?: ReactNode }) {
  const { icone: Icone, fundo, cor } = cfg[tipo];
  return (
    <div role={tipo === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-card px-4 py-3.5 text-base ${fundo} hc:border-2 hc:border-line-strong`}>
      <Icone aria-hidden="true" className={`mt-px size-[22px] shrink-0 ${cor}`} strokeWidth={1.75} />
      <div className="grid gap-1">
        <strong className={`font-semibold ${cor}`}>{titulo}</strong>
        {children && <p className="text-ink">{children}</p>}
        {acao}
      </div>
    </div>
  );
}

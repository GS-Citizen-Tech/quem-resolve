// Selo reutilizável: cor + ícone + palavra (nunca só cor). Usado para confiança,
// prioridade, origem e status, no app do cidadão e (compacto) no console.
import type { LucideIcon } from "lucide-react";
import { Bus, CircleCheck, CircleHelp, Clock, OctagonAlert, Send, TriangleAlert, User, Users } from "lucide-react";
import { nivelConfianca, type Origem, type Status } from "@/providers/tipos";

export type Tom = "ok" | "warn" | "danger" | "info" | "neutro";

const tons: Record<Tom, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutro: "bg-rail-active text-on-rail-active",
};

export function Selo({ tom, icone: Icone, texto, compacto = false }: { tom: Tom; icone: LucideIcon; texto: string; compacto?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip font-semibold hc:shadow-[inset_0_0_0_2px_currentColor] ${tons[tom]} ${compacto ? "min-h-[26px] px-2 text-[13px]" : "min-h-8 py-1 pr-3 pl-2.5 text-base"}`}>
      <Icone aria-hidden="true" className={compacto ? "size-4" : "size-[18px]"} strokeWidth={2.25} />
      {texto}
    </span>
  );
}

/** Alta ≥ 80% · média 50–79% · baixa < 50% (baixa é pergunta, não erro). */
export function SeloConfianca({ valor, compacto = false }: { valor: number; compacto?: boolean }) {
  const pct = Math.round(valor * 100);
  const n = nivelConfianca(valor);
  const cfg = {
    alta: { tom: "ok" as const, icone: CircleCheck, palavra: "Confiança alta" },
    media: { tom: "warn" as const, icone: TriangleAlert, palavra: "Confiança média" },
    baixa: { tom: "danger" as const, icone: CircleHelp, palavra: "Confiança baixa" },
  }[n];
  return <Selo tom={cfg.tom} icone={cfg.icone} compacto={compacto} texto={compacto ? cfg.palavra.replace("Confiança ", "") : `${cfg.palavra} (${pct}%)`} />;
}

/** `curto`: só "Alta", "Média" ou "Baixa" (em tabela, a coluna já diz que é prioridade). Só a alta e a média levam cor. */
export function SeloPrioridade({ valor, compacto = true, curto = false }: { valor: number; compacto?: boolean; curto?: boolean }) {
  const nome = valor >= 4 ? "alta" : valor === 3 ? "média" : "baixa";
  const texto = curto ? nome[0].toUpperCase() + nome.slice(1) : `Prioridade ${nome}`;
  if (valor >= 4) return <Selo tom="danger" icone={OctagonAlert} compacto={compacto} texto={texto} />;
  if (valor === 3) return <Selo tom="warn" icone={TriangleAlert} compacto={compacto} texto={texto} />;
  if (curto) return <span className="inline-flex min-h-[26px] items-center px-2 text-[13px] text-ink-muted">{texto}</span>;
  return <Selo tom="neutro" icone={CircleCheck} compacto={compacto} texto={texto} />;
}

/** Origem em texto simples com ícone (tabelas): sem pílula, para não competir com a prioridade. */
export function TextoOrigem({ origem }: { origem: Origem }) {
  const cfg = { cidadao: { icone: User, texto: "Cidadão" }, frota: { icone: Bus, texto: "Ônibus" }, ambos: { icone: Users, texto: "Cidadão e ônibus" } }[origem];
  return (
    <span className={`inline-flex items-center gap-1.5 ${origem === "ambos" ? "font-semibold text-ink" : "text-ink-muted"}`}>
      <cfg.icone aria-hidden="true" className="size-4" strokeWidth={1.75} />{cfg.texto}
    </span>
  );
}

export function SeloOrigem({ origem, compacto = true }: { origem: Origem; compacto?: boolean }) {
  const cfg = {
    cidadao: { icone: User, texto: "Cidadão" },
    frota: { icone: Bus, texto: "Ônibus" },
    ambos: { icone: Users, texto: "Cidadão + ônibus" },
  }[origem];
  return <Selo tom={origem === "ambos" ? "info" : "neutro"} icone={cfg.icone} compacto={compacto} texto={cfg.texto} />;
}


/** Status da ocorrência no console (o app do cidadão usa textos mais explicados em Meus reportes). */
export function SeloStatus({ status, compacto = true }: { status: Status; compacto?: boolean }) {
  const cfg = {
    pendente_envio: { tom: "neutro" as const, icone: Clock, texto: "Aguardando envio" },
    enviada: { tom: "info" as const, icone: Send, texto: "Enviada ao órgão" },
    possivelmente_resolvida: { tom: "warn" as const, icone: TriangleAlert, texto: "Possivelmente resolvida" },
    resolvida: { tom: "ok" as const, icone: CircleCheck, texto: "Resolvida" },
  }[status];
  return <Selo tom={cfg.tom} icone={cfg.icone} compacto={compacto} texto={cfg.texto} />;
}

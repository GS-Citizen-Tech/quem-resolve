import { FluxoReportar } from "@/features/reportar/FluxoReportar";

export const metadata = { title: "Reportar problema" };

// Fluxo do cidadão (F1, docs/PLANO-F1.md): captura → resultado → confirmação → protocolo.
export default function Page() {
  return <FluxoReportar />;
}

import { Painel } from "@/ui/Vidro";
import { Vazio } from "@/ui/Estados";

export const metadata = { title: "Tirar dúvida" };

// Tela planejada para a fase F2 (docs/PLANO-FRONT.md).
export default function Page() {
  return (
    <Painel className="grid gap-4">
      <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Tirar dúvida</h1>
      <Vazio titulo="Em construção" texto="Esta tela entra na fase F2." />
    </Painel>
  );
}

import { BarraTopo } from "@/ui/Navegacao";
import { Painel } from "@/ui/Vidro";
import { Vazio } from "@/ui/Estados";

export const metadata = { title: "Console da gestão" };

// Login do gestor e console: fase F3 (docs/PLANO-FRONT.md).
export default function Page() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4">
      <BarraTopo inicio="/gestao" />
      <Painel as="main">
        <h1 className="mb-4 text-[26px] leading-8 font-medium tracking-[-0.03em]">Console da gestão</h1>
        <Vazio titulo="Em construção" texto="Login e console entram na fase F3." />
      </Painel>
    </div>
  );
}

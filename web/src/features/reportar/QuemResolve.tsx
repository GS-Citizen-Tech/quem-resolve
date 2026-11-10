// Cartão "Quem resolve": órgão, canal, telefone e link oficial.
import { Building2, ExternalLink, Phone } from "lucide-react";
import { CartaoVidro } from "@/ui/Vidro";
import type { Responsavel } from "@/providers/tipos";

export function QuemResolve({ responsavel, indice }: { responsavel: Responsavel; indice?: number }) {
  const temTelefone = /^\d{3,}$/.test(responsavel.contato.replace(/\D/g, "")) && !/validar/i.test(responsavel.contato);
  return (
    <CartaoVidro rotulo="Quem resolve" icone={Building2} titulo={responsavel.nome} indice={indice}>
      <div className="mt-3 grid gap-2">
        <p><span className="text-ink-muted">Canal: </span><strong>{responsavel.canal}</strong></p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {temTelefone
            ? <a href={`tel:${responsavel.contato}`} className="inline-flex min-h-toque items-center gap-2 font-semibold underline underline-offset-4 hover:text-destaque"><Phone aria-hidden="true" className="size-5" />Ligar {responsavel.contato}</a>
            : <p className="inline-flex min-h-toque items-center text-ink-muted">Telefone a confirmar no site oficial</p>}
          {responsavel.url && (
            <a href={responsavel.url} target="_blank" rel="noreferrer" className="inline-flex min-h-toque items-center gap-2 font-semibold underline underline-offset-4 hover:text-destaque">
              <ExternalLink aria-hidden="true" className="size-5" />Site oficial<span className="sr-only"> (abre em nova aba)</span>
            </a>
          )}
        </div>
      </div>
    </CartaoVidro>
  );
}

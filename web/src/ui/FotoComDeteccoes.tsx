// Foto com as caixas da detecção desenhadas. Cada caixa tem rótulo escrito
// (nunca só cor) e a lista abaixo repete tudo em texto para leitores de tela.
// Reaproveitado na F3 (recortes da frota e qualidade da IA).
import { ScanSearch } from "lucide-react";
import type { Deteccao } from "@/providers/tipos";

/** Nomes amigáveis das classes do modelo (RDD2022). Só para exibição. */
export const NOMES_VISAO: Record<string, string> = {
  D40: "Buraco",
  D00: "Rachadura no sentido da via",
  D10: "Rachadura atravessada",
  D20: "Asfalto em \"couro de jacaré\"",
  pothole: "Buraco",
};
export const nomeVisao = (classe: string) => NOMES_VISAO[classe] ?? classe;
/** Nome para a legenda: a frase do multimodal quando a detecção veio dele. */
const nomeDeteccao = (d: Deteccao) => (d.origem === "multimodal" && d.descricao ? d.descricao : nomeVisao(d.classe));
/** Rótulo curto para caber em cima da caixa (o nome completo fica na legenda). */
const CURTO: Record<string, string> = { D00: "Rachadura", D10: "Rachadura", D20: "Jacaré", D40: "Buraco", pothole: "Buraco" };

export function FotoComDeteccoes({ src, deteccoes, compacto = false }: { src: string; deteccoes: Deteccao[]; compacto?: boolean }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;
  return (
    <figure className="grid gap-2">
      <div className="relative overflow-hidden rounded-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={deteccoes.length ? `Sua foto, com ${deteccoes.length} marcação(ões) do que a IA encontrou` : "Sua foto"}
          className={`block w-full object-contain ${compacto ? "max-h-56" : "max-h-[420px]"} bg-surface-raised`} />
        {deteccoes.map((d, i) => {
          if (!d.bbox) return null; // o multimodal nem sempre marca onde está: fica só a legenda
          const [x1, y1, x2, y2] = d.bbox;
          return (
            <div key={i} aria-hidden="true" className="absolute rounded-[6px] border-[3px] border-destaque shadow-[0_0_0_2px_#fff8]"
              style={{ left: pct(x1), top: pct(y1), width: pct(x2 - x1), height: pct(y2 - y1) }}>
              <span className={`absolute ${y1 < 0.12 ? "top-full translate-y-px" : "-top-px -translate-y-full"} ${(x1 + x2) / 2 > 0.5 ? "right-0" : "left-0"} rounded-[4px] bg-primary px-1.5 py-0.5 text-sm font-semibold whitespace-nowrap text-primary-foreground`}>
                {CURTO[d.classe] ?? "Problema"} {Math.round(d.confianca * 100)}%
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="flex items-start gap-2 text-base text-ink-muted">
        <ScanSearch aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destaque" />
        {deteccoes.length
          ? <span>
              Na foto: {deteccoes.map((d) => `${nomeDeteccao(d)} (${Math.round(d.confianca * 100)}%)`).join(", ")}.
              {deteccoes.some((d) => d.origem === "multimodal") && " Identificado por um modelo de IA geral, confira se está certo."}
            </span>
          : <span>A IA não marcou nada na foto. Usei a sua descrição.</span>}
      </figcaption>
    </figure>
  );
}

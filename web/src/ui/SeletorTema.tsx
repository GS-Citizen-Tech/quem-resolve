"use client";
// Aparência: um botão só no topo, que abre as 3 opções (claro, escuro, alto contraste).
import { Check, Contrast, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppState, type Tema } from "@/state/AppState";

const opcoes: { tema: Tema; rotulo: string; icone: typeof Sun }[] = [
  { tema: "claro", rotulo: "Claro", icone: Sun },
  { tema: "escuro", rotulo: "Escuro", icone: Moon },
  { tema: "alto-contraste", rotulo: "Alto contraste", icone: Contrast },
];

/** `abre`: para onde o menu abre ("baixo" no topo da tela, "cima" no pé da barra lateral do console). */
export function SeletorTema({ abre = "baixo", comRotulo = false }: { abre?: "baixo" | "cima"; comRotulo?: boolean }) {
  const { estado, despachar } = useAppState();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const Atual = opcoes.find((o) => o.tema === estado.tema)?.icone ?? Sun;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setAberto(false); botao.current?.focus(); } };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button ref={botao} type="button" aria-label="Aparência" title="Aparência" aria-haspopup="true" aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className={comRotulo
          ? "flex min-h-console w-full cursor-pointer items-center gap-2.5 rounded-chip px-2.5 text-sm font-medium text-ink-muted hover:bg-rail-active/55 hover:text-ink aria-expanded:bg-rail-active aria-expanded:text-on-rail-active"
          : "grid size-12 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-rail-active/45 hover:text-ink aria-expanded:bg-rail-active aria-expanded:text-on-rail-active"}>
        <Atual aria-hidden="true" className={comRotulo ? "size-[18px]" : "size-5"} strokeWidth={1.75} />
        {comRotulo && "Aparência"}
      </button>
      {aberto && (
        <div role="group" aria-label="Aparência"
          className={`absolute z-40 grid w-52 gap-0.5 ${abre === "cima" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"} rounded-control border border-line-strong bg-surface-raised p-1.5 shadow-glass hc:border-2 hc:shadow-none`}>
          {opcoes.map(({ tema, rotulo, icone: Icone }) => {
            const marcado = estado.tema === tema;
            return (
              <button key={tema} type="button" aria-pressed={marcado}
                onClick={() => { despachar({ tipo: "tema", tema }); setAberto(false); botao.current?.focus(); }}
                className="flex min-h-toque cursor-pointer items-center gap-3 rounded-chip px-3 text-left text-base text-ink hover:bg-rail-active/55 aria-pressed:font-semibold">
                <Icone aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
                <span className="flex-1">{rotulo}</span>
                {marcado && <Check aria-hidden="true" className="size-5 text-destaque" strokeWidth={2.25} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

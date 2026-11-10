"use client";
import { Contrast, Moon, Sun } from "lucide-react";
import { useAppState, type Tema } from "@/state/AppState";

const opcoes: { tema: Tema; rotulo: string; icone: typeof Sun }[] = [
  { tema: "claro", rotulo: "Tema claro", icone: Sun },
  { tema: "escuro", rotulo: "Tema escuro", icone: Moon },
  { tema: "alto-contraste", rotulo: "Alto contraste", icone: Contrast },
];

export function SeletorTema() {
  const { estado, despachar } = useAppState();
  return (
    <div role="group" aria-label="Aparência" className="flex gap-1">
      {opcoes.map(({ tema, rotulo, icone: Icone }) => (
        <button key={tema} type="button" aria-label={rotulo} title={rotulo} aria-pressed={estado.tema === tema}
          onClick={() => despachar({ tipo: "tema", tema })}
          className="grid size-12 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-rail-active/45 hover:text-ink aria-pressed:bg-rail-active aria-pressed:text-on-rail-active">
          <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

"use client";
// Lista suspensa única do app (16/11): botão + lista própria, no lugar do <select> do navegador (que abria azul e quadrado).
// Acessível: o botão abre a lista (aria-haspopup="listbox"); setas, Home/End e a primeira letra andam; Enter escolhe;
// Esc fecha e volta o foco para o botão. Com muitas opções (ex.: 96 bairros) aparece um campo para procurar.
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface OpcaoSelecao { valor: string; rotulo: string }

const BUSCA_A_PARTIR_DE = 12;
const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Selecao({ id, valor, opcoes, aoMudar, className = "", rotuloVazio }: {
  /** Liga o <label htmlFor> ao botão. */
  id: string;
  valor: string;
  opcoes: OpcaoSelecao[];
  aoMudar: (valor: string) => void;
  className?: string;
  /** Texto do botão quando o valor não está nas opções. */
  rotuloVazio?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [busca, setBusca] = useState("");
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const base = useId();
  const comBusca = opcoes.length > BUSCA_A_PARTIR_DE;

  const visiveis = useMemo(() => {
    const t = semAcento(busca.trim());
    return t ? opcoes.filter((o) => semAcento(o.rotulo).includes(t)) : opcoes;
  }, [opcoes, busca]);
  const atual = opcoes.find((o) => o.valor === valor);

  const abrir = (indice?: number) => {
    const i = indice ?? Math.max(0, opcoes.findIndex((o) => o.valor === valor));
    setBusca(""); setAtivo(i); setAberta(true);
  };
  const fechar = (focar = true) => { setAberta(false); if (focar) botao.current?.focus(); };
  const escolher = (o: OpcaoSelecao | undefined) => { if (!o) return; if (o.valor !== valor) aoMudar(o.valor); fechar(); };

  // Ao abrir: foco no campo de busca (lista longa) ou na lista.
  useEffect(() => {
    if (!aberta) return;
    (comBusca ? campo.current : lista.current)?.focus();
  }, [aberta, comBusca]);

  // Opção ativa sempre visível dentro da lista.
  useEffect(() => {
    if (aberta) lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aberta, ativo, visiveis]);

  // Clique fora fecha sem roubar o foco.
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  const teclaBotao = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrir(); }
  };

  const teclaLista = (e: React.KeyboardEvent) => {
    const n = visiveis.length;
    const mover = (i: number) => { e.preventDefault(); setAtivo(Math.max(0, Math.min(n - 1, i))); };
    switch (e.key) {
      case "ArrowDown": return mover(ativo + 1);
      case "ArrowUp": return mover(ativo - 1);
      case "Home": return comBusca ? undefined : mover(0);
      case "End": return comBusca ? undefined : mover(n - 1);
      case "PageDown": return mover(ativo + 8);
      case "PageUp": return mover(ativo - 8);
      case "Enter": e.preventDefault(); return escolher(visiveis[ativo]);
      case " ": if (comBusca) return; e.preventDefault(); return escolher(visiveis[ativo]);
      case "Escape": e.preventDefault(); return fechar();
      case "Tab": return fechar(false);
      default:
        if (!comBusca && e.key.length === 1) { // primeira letra: pula para a próxima opção que começa com ela
          const l = semAcento(e.key);
          const i = visiveis.findIndex((o, k) => k > ativo && semAcento(o.rotulo).startsWith(l));
          const j = i >= 0 ? i : visiveis.findIndex((o) => semAcento(o.rotulo).startsWith(l));
          if (j >= 0) setAtivo(j);
        }
    }
  };

  const idLista = `${base}-lista`;
  const idOpcao = (i: number) => `${base}-op-${i}`;

  return (
    <div ref={caixa} className={`relative ${className}`}>
      <button ref={botao} id={id} type="button" aria-haspopup="listbox" aria-expanded={aberta} aria-controls={aberta ? idLista : undefined}
        onClick={() => (aberta ? fechar() : abrir())} onKeyDown={teclaBotao}
        className={`flex min-h-console w-full cursor-pointer items-center justify-between gap-2 rounded-chip border bg-surface-raised pr-2 pl-2.5 text-left text-sm text-ink hover:border-ink ${aberta ? "border-ink" : "border-line-strong"}`}>
        <span className="truncate">{atual?.rotulo ?? rotuloVazio ?? "Escolha"}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none ${aberta ? "rotate-180" : ""}`} />
      </button>

      {aberta && (
        <div className="absolute top-full left-0 z-50 mt-1.5 grid w-max max-w-[min(22rem,calc(100vw-2rem))] min-w-full gap-1 rounded-control border border-line-strong bg-surface-raised p-1.5 shadow-glass hc:border-2 hc:shadow-none">
          {comBusca && (
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" />
              <input ref={campo} type="text" value={busca} placeholder="Procurar" autoComplete="off"
                role="combobox" aria-expanded="true" aria-controls={idLista} aria-autocomplete="list" aria-label="Procurar na lista"
                aria-activedescendant={visiveis[ativo] ? idOpcao(ativo) : undefined}
                onChange={(e) => { setBusca(e.target.value); setAtivo(0); }} onKeyDown={teclaLista}
                className="min-h-console w-full rounded-chip border border-line bg-surface-solid pr-2 pl-8 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-0" />
            </div>
          )}
          <ul ref={lista} id={idLista} role="listbox" tabIndex={comBusca ? -1 : 0} aria-labelledby={id}
            aria-activedescendant={!comBusca && visiveis[ativo] ? idOpcao(ativo) : undefined} onKeyDown={comBusca ? undefined : teclaLista}
            className="grid max-h-72 overflow-y-auto overscroll-contain focus-visible:outline-none">
            {visiveis.map((o, i) => {
              const marcada = o.valor === valor;
              return (
                <li key={o.valor} id={idOpcao(i)} data-i={i} role="option" aria-selected={marcada}
                  onPointerMove={() => setAtivo(i)} onClick={() => escolher(o)}
                  className={`flex min-h-console cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2.5 text-sm ${i === ativo ? "bg-[color-mix(in_srgb,var(--qr-ink)_8%,transparent)] hc:outline-2 hc:outline-ink" : ""} ${marcada ? "font-semibold" : ""}`}>
                  <span>{o.rotulo}</span>
                  {marcada && <Check aria-hidden="true" className="size-4 shrink-0 text-destaque" strokeWidth={2.25} />}
                </li>
              );
            })}
            {!visiveis.length && <li role="presentation" className="px-2.5 py-2 text-sm text-ink-muted">Nada encontrado</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";
// Alerta OuviAí (IoT): o celular com o modelo do Edge Impulse ouve a sirene/buzina e manda o
// evento para a API; aqui só mostramos o aviso visual + vibração (pensado para pessoas surdas).
// Consulta GET /iot/eventos a cada 5 s, só com a aba visível e com os avisos ligados.
import { Bell, BellOff, Car, Siren } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/providers/api";
import type { EventoSom } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";

const INTERVALO_MS = 5_000;
const VALIDADE_MS = 60_000;

export function AlertaSom() {
  const { estado, despachar } = useAppState();
  const [alerta, setAlerta] = useState<EventoSom | null>(null);
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    if (!estado.carregado || !estado.avisosSom) return;
    let vivo = true;
    const consultar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const eventos = await api.eventosSom(5);
        const novo = eventos.find((e) => e.alerta && !vistos.current.has(e.id) && Date.now() - new Date(e.recebido_em).getTime() < VALIDADE_MS);
        eventos.forEach((e) => vistos.current.add(e.id));
        if (vivo && novo) {
          setAlerta(novo);
          try { navigator.vibrate?.([300, 120, 300, 120, 300]); } catch { /* sem vibração */ }
        }
      } catch { /* OuviAí fora do ar: fica em silêncio, não atrapalha o app */ }
    };
    consultar();
    const id = setInterval(consultar, INTERVALO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [estado.carregado, estado.avisosSom]);

  // Some sozinho quando o evento passa de 60 s.
  useEffect(() => {
    if (!alerta) return;
    const resta = VALIDADE_MS - (Date.now() - new Date(alerta.recebido_em).getTime());
    const t = setTimeout(() => setAlerta(null), Math.max(resta, 5_000));
    return () => clearTimeout(t);
  }, [alerta]);

  if (!alerta || !estado.avisosSom) return null;
  const Icone = alerta.classe === "sirene" ? Siren : Car;
  const titulo = alerta.classe === "sirene" ? "Sirene por perto" : "Buzina por perto";
  // A mensagem da API começa repetindo o título ("Sirene por perto. ..."): mostra só o resto.
  const detalhe = alerta.mensagem.startsWith(titulo) ? alerta.mensagem.slice(titulo.length).replace(/^[.\s]+/, "") : alerta.mensagem;
  const hora = new Date(alerta.recebido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="alert" className="glass sticky top-2 z-30 grid gap-3 rounded-card border-2 border-warn bg-warn-soft! p-4 shadow-float sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <Icone aria-hidden="true" className="mt-0.5 size-8 shrink-0 text-warn motion-safe:animate-pulse" strokeWidth={2} />
        <div className="grid gap-0.5">
          <strong className="text-xl text-warn">{titulo}</strong>
          {detalhe && <p className="text-ink">{detalhe}</p>}
          <p className="text-base text-ink-muted">Ouvido pelo OuviAí às {hora} · {Math.round(alerta.confianca * 100)}% de certeza</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAlerta(null)}
          className="min-h-toque cursor-pointer rounded-control bg-primary px-5 text-[17px] font-semibold text-primary-foreground hover:bg-brand-hover">Entendi</button>
        <button type="button" onClick={() => { setAlerta(null); despachar({ tipo: "avisosSom", ligado: false }); }}
          className="min-h-toque cursor-pointer rounded-control px-4 text-[17px] font-semibold text-ink underline underline-offset-4">Desligar avisos</button>
      </div>
    </div>
  );
}

/** Liga/desliga os avisos de som, na barra do topo. */
export function BotaoAvisosSom() {
  const { estado, despachar } = useAppState();
  const ligado = estado.avisosSom;
  const rotulo = ligado ? "Avisos de som ligados (OuviAí). Tocar para desligar" : "Avisos de som desligados (OuviAí). Tocar para ligar";
  return (
    <button type="button" aria-label={rotulo} title={rotulo} aria-pressed={ligado}
      onClick={() => despachar({ tipo: "avisosSom", ligado: !ligado })}
      className="grid size-12 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-rail-active/45 hover:text-ink">
      {ligado ? <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <BellOff aria-hidden="true" className="size-5" strokeWidth={1.75} />}
    </button>
  );
}

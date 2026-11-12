"use client";
// Mapa com Leaflet + OpenStreetMap (grátis, sem chave e sem cartão). Reaproveitado no console (Mapa e Frota) e no
// "Ajustar no mapa" do cidadão.
// - Pontos: a forma mostra quem achou (círculo = cidadão, quadrado = ônibus, losango = os dois) e a cor a prioridade.
//   A legenda escrita fica fora do mapa (cor nunca sozinha).
// - Sem internet para o mapa de fundo: os pontos e trajetos continuam no mapa e a lista da tela segue visível.
// - O mapa só desenha: o resumo do ponto escolhido fica na tela que usa o componente (acessível e testável).
import { MapPinOff } from "lucide-react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Origem } from "@/providers/tipos";

export type TomPonto = "danger" | "warn" | "ok" | "neutro";
export interface PontoMapa { id: string; lat: number; lon: number; titulo: string; origem: Origem; tom: TomPonto }
export interface TrajetoMapa { id: string; rotulo: string; pontos: [number, number][] }

type L = typeof Leaflet;
const CENTRO_SP: [number, number] = [-23.5505, -46.6333];

// ---------- Aparência (cores do tema) ----------

const lerCor = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || "#285a44";
const corDoTom: Record<TomPonto, string> = { danger: "--qr-danger", warn: "--qr-warn", ok: "--qr-ok", neutro: "--qr-ink-muted" };

function icone(l: L, origem: Origem, tom: TomPonto, grande: boolean) {
  const t = grande ? 32 : 22;
  const cor = lerCor(corDoTom[tom]);
  const forma = origem === "cidadao" ? `<circle cx="12" cy="12" r="8.5"/>`
    : origem === "frota" ? `<rect x="4" y="4" width="16" height="16" rx="2"/>`
    : `<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 24 24"><g fill="${cor}" stroke="#fff" stroke-width="2.5">${forma}</g></svg>`;
  return l.divIcon({ html: svg, className: "qr-ponto", iconSize: [t, t], iconAnchor: [t / 2, t / 2] });
}

/** Pino do "Ajustar no mapa": desenhado aqui (o ícone padrão do Leaflet depende de imagens que o bundler não serve). */
function iconePino(l: L) {
  const cor = lerCor("--qr-destaque");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 46C20 46 4 30 4 18a16 16 0 0 1 32 0c0 12-16 28-16 28Z" fill="${cor}" stroke="#fff" stroke-width="3"/><circle cx="20" cy="18" r="6" fill="#fff"/></svg>`;
  return l.divIcon({ html: svg, className: "qr-ponto", iconSize: [40, 48], iconAnchor: [20, 46] });
}

// ---------- Componente ----------

export function MapaOcorrencias({ pontos = [], trajetos = [], selecionado, aoSelecionar, pino, rotulo, altura = 420 }: {
  pontos?: PontoMapa[];
  trajetos?: TrajetoMapa[];
  selecionado?: string | null;
  aoSelecionar?: (id: string) => void;
  /** Modo "Ajustar no mapa": um pino que dá para arrastar (ou tocar no mapa para mover). */
  pino?: { lat: number; lon: number; aoMover: (lat: number, lon: number) => void };
  rotulo: string;
  altura?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lib = useRef<L | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Leaflet.Marker>());
  const marcadorPino = useRef<Leaflet.Marker | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [semFundo, setSemFundo] = useState(false);
  const [tema, setTema] = useState(0);
  const cb = useRef({ aoSelecionar, pino });
  useEffect(() => { cb.current = { aoSelecionar, pino }; });

  // Cria o mapa uma vez (o Leaflet só roda no navegador, por isso o import dinâmico).
  useEffect(() => {
    let vivo = true;
    const pontosNoMapa = marcadores.current;
    import("leaflet").then((mod) => {
      if (!vivo || !ref.current) return;
      const l = ((mod as unknown as { default?: L }).default ?? mod) as L;
      lib.current = l;
      const m = l.map(ref.current, { center: CENTRO_SP, zoom: 12, zoomControl: true, attributionControl: true });
      l.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => vivo && setSemFundo(true)).on("tileload", () => vivo && setSemFundo(false)).addTo(m);
      camada.current = l.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => cb.current.pino?.aoMover(e.latlng.lat, e.latlng.lng));
      mapa.current = m;
      setEstado("pronto");
    }).catch(() => vivo && setEstado("falhou"));
    const obs = new MutationObserver(() => setTema((x) => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      vivo = false;
      obs.disconnect();
      mapa.current?.remove();
      mapa.current = null; camada.current = null; marcadorPino.current = null; pontosNoMapa.clear();
    };
  }, []);

  // Pontos e trajetos (e redesenho quando o tema muda, para os ícones pegarem as cores novas).
  useEffect(() => {
    const m = mapa.current, l = lib.current, g = camada.current;
    if (estado !== "pronto" || !m || !l || !g) return;
    g.clearLayers();
    marcadores.current.clear();
    const todos: Leaflet.LatLngExpression[] = [];
    const corLinha = lerCor("--chart-1");
    for (const t of trajetos) {
      todos.push(...t.pontos);
      l.polyline(t.pontos, { color: corLinha, weight: 5, opacity: 0.85 }).addTo(g);
    }
    for (const p of pontos) {
      todos.push([p.lat, p.lon]);
      const mk = l.marker([p.lat, p.lon], { icon: icone(l, p.origem, p.tom, p.id === selecionado), title: p.titulo, alt: p.titulo, zIndexOffset: p.id === selecionado ? 1000 : 0 });
      mk.on("click", () => cb.current.aoSelecionar?.(p.id));
      mk.addTo(g);
      marcadores.current.set(p.id, mk);
    }
    if (!pino && todos.length) {
      m.fitBounds(l.latLngBounds(todos), { padding: [40, 40], maxZoom: todos.length === 1 ? 16 : 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, pontos, trajetos, tema]);

  // Ponto escolhido: aumenta e centraliza.
  useEffect(() => {
    const l = lib.current;
    if (estado !== "pronto" || !l) return;
    for (const p of pontos) {
      const mk = marcadores.current.get(p.id);
      mk?.setIcon(icone(l, p.origem, p.tom, p.id === selecionado));
      mk?.setZIndexOffset(p.id === selecionado ? 1000 : 0);
    }
    const sel = pontos.find((p) => p.id === selecionado);
    if (sel) mapa.current?.panTo([sel.lat, sel.lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, estado]);

  // Pino arrastável ("Ajustar no mapa").
  useEffect(() => {
    const m = mapa.current, l = lib.current;
    if (estado !== "pronto" || !m || !l || !pino) return;
    const pos: [number, number] = [pino.lat, pino.lon];
    if (!marcadorPino.current) {
      const mk = l.marker(pos, { icon: iconePino(l), draggable: true, title: "Local do problema (arraste para ajustar)", alt: "Local do problema (arraste para ajustar)" }).addTo(m);
      mk.on("dragend", () => { const p = mk.getLatLng(); cb.current.pino?.aoMover(p.lat, p.lng); });
      marcadorPino.current = mk;
      m.setView(pos, 17);
    } else {
      marcadorPino.current.setLatLng(pos);
      if (!m.getBounds().contains(pos)) m.panTo(pos);
    }
  }, [estado, pino]);

  if (estado === "falhou") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface-raised px-4 py-4 text-sm">
        <MapPinOff aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <div className="grid gap-0.5">
          <strong className="font-semibold">Mapa indisponível agora</strong>
          <span className="text-ink-muted">
            Não deu para carregar o mapa.{pino ? " Você pode continuar com a localização do aparelho." : " A lista abaixo mostra as mesmas ocorrências."}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <div className="relative overflow-hidden rounded-card bg-surface-raised" style={{ height: altura }}>
        <div ref={ref} role="region" aria-label={rotulo} className="qr-mapa size-full" />
        {estado === "carregando" && <p role="status" className="absolute inset-0 z-[500] grid place-items-center text-sm text-ink-muted">Carregando o mapa…</p>}
      </div>
      {semFundo && (
        <p role="status" className="text-xs text-ink-muted">O mapa de fundo não carregou (sem internet?). Os pontos continuam aqui e na lista.</p>
      )}
    </div>
  );
}

/** Legenda escrita do mapa (a forma e a cor sempre com palavra). */
export function LegendaMapa({ comTrajeto = false }: { comTrajeto?: boolean }) {
  const forma = (d: string) => <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-ink-muted stroke-surface-raised stroke-2">{d === "c" ? <circle cx="12" cy="12" r="8.5" /> : d === "q" ? <rect x="4" y="4" width="16" height="16" rx="2" /> : <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />}</svg>;
  const cor = (c: string, t: string) => <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-3 rounded-full ${c}`} />{t}</span>;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs" aria-label="Legenda do mapa">
      <span className="inline-flex items-center gap-1.5">{forma("c")}Cidadão</span>
      <span className="inline-flex items-center gap-1.5">{forma("q")}Ônibus</span>
      <span className="inline-flex items-center gap-1.5">{forma("l")}Cidadão + ônibus</span>
      <span className="text-ink-muted">·</span>
      {cor("bg-danger", "Prioridade alta (4–5)")}
      {cor("bg-warn", "Média (3)")}
      {cor("bg-ok", "Baixa (1–2)")}
      {cor("bg-ink-muted", "Resolvida ou possivelmente resolvida")}
      {comTrajeto && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1 w-5 rounded-full bg-chart-1" />Trajeto do ônibus</span>}
    </div>
  );
}

export const tomDaOcorrencia = (o: { prioridade: number; status: string }): TomPonto =>
  o.status === "resolvida" || o.status === "possivelmente_resolvida" ? "neutro" : o.prioridade >= 4 ? "danger" : o.prioridade === 3 ? "warn" : "ok";

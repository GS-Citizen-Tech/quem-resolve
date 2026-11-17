"use client";
// Mapa com Leaflet + OpenStreetMap (grátis, sem chave e sem cartão). Reaproveitado no console (Mapa e Frota) e no
// mapa em tela cheia do Reportar (modo `centro`: o pino fica parado no meio e a pessoa arrasta o mapa).
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
/** `quantidade` (v1.3): quantos reportes do mesmo problema. A bola cresce com ela e mostra o número. */
export interface PontoMapa { id: string; lat: number; lon: number; titulo: string; origem: Origem; tom: TomPonto; quantidade?: number }
/** Camada de áreas (v1.3): os distritos pintados por um valor (ex.: problemas abertos). */
export interface AreasMapa {
  geojson: import("geojson").FeatureCollection;
  /** Valor de cada área pelo id (properties.id). Define o tom (0 a 4) pela faixa. */
  valores: Record<string, number>;
  faixas: number[];           // limites superiores das faixas 0..3; acima do último = faixa 4
  selecionada?: string | null;
  aoEscolher?: (id: string) => void;
  rotuloDe: (id: string) => string;
}
/** Transparência do preenchimento por faixa (o tom é sempre a cor de destaque do tema). */
export const OPACIDADE_FAIXA = [0.04, 0.16, 0.3, 0.46, 0.64];
export const faixaDe = (v: number, faixas: number[]) => { const i = faixas.findIndex((f) => v <= f); return i === -1 ? faixas.length : i; };
export interface TrajetoMapa { id: string; rotulo: string; pontos: [number, number][] }

type L = typeof Leaflet;
const CENTRO_SP: [number, number] = [-23.5505, -46.6333];

// ---------- Aparência (cores do tema) ----------

const lerCor = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || "#285a44";
const corDoTom: Record<TomPonto, string> = { danger: "--qr-danger", warn: "--qr-warn", ok: "--qr-ok", neutro: "--qr-ink-muted" };

function icone(l: L, origem: Origem, tom: TomPonto, grande: boolean, quantidade = 1) {
  // Área da bola cresce com a raiz do nº de reportes (8 reportes ≈ 2,8× o diâmetro), com teto para não cobrir o bairro.
  const base = Math.min(22 * Math.sqrt(quantidade), 64);
  const t = Math.round(grande ? base + 10 : base);
  const cor = lerCor(corDoTom[tom]);
  const forma = origem === "cidadao" ? `<circle cx="12" cy="12" r="8.5"/>`
    : origem === "frota" ? `<rect x="4" y="4" width="16" height="16" rx="2"/>`
    : `<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/>`;
  const numero = quantidade > 1
    ? `<text x="12" y="12.6" text-anchor="middle" dominant-baseline="middle" font-size="${quantidade > 9 ? 7 : 8.5}" font-weight="700" fill="#fff" font-family="inherit">${quantidade}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 24 24"><g fill="${cor}" stroke="#fff" stroke-width="${quantidade > 1 ? 1.6 : 2.5}">${forma}</g>${numero}</svg>`;
  return l.divIcon({ html: svg, className: "qr-ponto", iconSize: [t, t], iconAnchor: [t / 2, t / 2] });
}

/** Pino do "Ajustar no mapa": desenhado aqui (o ícone padrão do Leaflet depende de imagens que o bundler não serve). */
function iconePino(l: L) {
  const cor = lerCor("--qr-destaque");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 46C20 46 4 30 4 18a16 16 0 0 1 32 0c0 12-16 28-16 28Z" fill="${cor}" stroke="#fff" stroke-width="3"/><circle cx="20" cy="18" r="6" fill="#fff"/></svg>`;
  return l.divIcon({ html: svg, className: "qr-ponto", iconSize: [40, 48], iconAnchor: [20, 46] });
}

// ---------- Componente ----------

export function MapaOcorrencias({ pontos = [], trajetos = [], foco, areas, selecionado, seguir = true, aoSelecionar, pino, centro, rotulo, altura = 420 }: {
  /** false: o ponto escolhido só cresce, o mapa não voa até ele (ex.: passar o mouse numa linha da lista). */
  seguir?: boolean;
  areas?: AreasMapa;
  /** Trecho em destaque (ex.: a linha de ônibus escolhida): o mapa dá zoom nele e desenha a linha mais grossa, com contorno. */
  foco?: [number, number][];
  pontos?: PontoMapa[];
  trajetos?: TrajetoMapa[];
  selecionado?: string | null;
  aoSelecionar?: (id: string) => void;
  /** Modo "Ajustar no mapa": um pino que dá para arrastar (ou tocar no mapa para mover). */
  pino?: { lat: number; lon: number; aoMover: (lat: number, lon: number) => void };
  /** Modo "pino fixo no centro" (v1.1): o pino é desenhado por cima, parado; arrastar o mapa muda o ponto. */
  centro?: { lat: number; lon: number; aoMover: (lat: number, lon: number) => void };
  rotulo: string;
  /** Número em px, ou "100%" para ocupar a altura do pai (tela cheia). */
  altura?: number | "100%";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lib = useRef<L | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const camadaAreas = useRef<Leaflet.GeoJSON | null>(null);
  const ultimaVista = useRef<string | null>(null);
  const marcadores = useRef(new Map<string, Leaflet.Marker>());
  const marcadorPino = useRef<Leaflet.Marker | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [semFundo, setSemFundo] = useState(false);
  const [tema, setTema] = useState(0);
  const cb = useRef({ aoSelecionar, pino, centro, areas, selecionado });
  useEffect(() => { cb.current = { aoSelecionar, pino, centro, areas, selecionado }; });

  // Cria o mapa uma vez (o Leaflet só roda no navegador, por isso o import dinâmico).
  useEffect(() => {
    let vivo = true;
    const pontosNoMapa = marcadores.current;
    import("leaflet").then((mod) => {
      if (!vivo || !ref.current) return;
      const l = ((mod as unknown as { default?: L }).default ?? mod) as L;
      lib.current = l;
      const inicio = cb.current.centro;
      const m = l.map(ref.current, { center: inicio ? [inicio.lat, inicio.lon] : CENTRO_SP, zoom: inicio ? 17 : 12, zoomControl: true, attributionControl: true });
      l.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => vivo && setSemFundo(true)).on("tileload", () => vivo && setSemFundo(false)).addTo(m);
      camada.current = l.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        if (cb.current.centro) m.panTo(e.latlng); // tocar num ponto leva o pino até lá
        else cb.current.pino?.aoMover(e.latlng.lat, e.latlng.lng);
      });
      m.on("moveend", () => { const c = m.getCenter(); cb.current.centro?.aoMover(c.lat, c.lng); });
      mapa.current = m;
      setEstado("pronto");
    }).catch(() => vivo && setEstado("falhou"));
    const obs = new MutationObserver(() => setTema((x) => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      vivo = false;
      obs.disconnect();
      mapa.current?.remove();
      mapa.current = null; camada.current = null; camadaAreas.current = null; marcadorPino.current = null; pontosNoMapa.clear();
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
    const destaque = !!foco?.length;
    for (const t of trajetos) {
      todos.push(...t.pontos);
      if (destaque) l.polyline(t.pontos, { color: lerCor("--qr-surface-raised") || "#fff", weight: 11, opacity: 0.95, interactive: false }).addTo(g); // contorno
      l.polyline(t.pontos, { color: corLinha, weight: destaque ? 6 : 5, opacity: destaque ? 1 : 0.85 }).addTo(g);
    }
    for (const p of pontos) {
      todos.push([p.lat, p.lon]);
      const mk = l.marker([p.lat, p.lon], { icon: icone(l, p.origem, p.tom, p.id === selecionado, p.quantidade), title: p.titulo, alt: p.titulo,
        zIndexOffset: p.id === selecionado ? 1000 : (p.quantidade ?? 1) * 10 }); // bolas grandes por cima das pequenas
      mk.on("click", () => cb.current.aoSelecionar?.(p.id));
      mk.addTo(g);
      marcadores.current.set(p.id, mk);
    }
    if (destaque) {
      // Linha escolhida: zoom na linha inteira (com animação, menos para quem pede menos movimento).
      const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.flyToBounds(l.latLngBounds(foco), { padding: [48, 48], maxZoom: 16, animate: !calmo, duration: 0.6 });
    } else if (!pino && !cb.current.centro && !cb.current.areas && todos.length) {
      m.fitBounds(l.latLngBounds(todos), { padding: [40, 40], maxZoom: todos.length === 1 ? 16 : 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, pontos, trajetos, foco, tema]);

  // Ponto escolhido: aumenta e centraliza. Roda de novo quando os pontos chegam (link "Ver no mapa" abre antes dos dados).
  const temSelecionado = !!selecionado && pontos.some((p) => p.id === selecionado);
  useEffect(() => {
    const l = lib.current;
    if (estado !== "pronto" || !l) return;
    for (const p of pontos) {
      const mk = marcadores.current.get(p.id);
      mk?.setIcon(icone(l, p.origem, p.tom, p.id === selecionado, p.quantidade));
      mk?.setZIndexOffset(p.id === selecionado ? 1000 : (p.quantidade ?? 1) * 10);
    }
    // Vai até o ponto e chega perto (no mapa da cidade inteira, só centralizar não mostrava qual foi o escolhido).
    const sel = pontos.find((p) => p.id === selecionado);
    const m = mapa.current;
    if (sel && m && seguir) {
      const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.flyTo([sel.lat, sel.lon], Math.max(m.getZoom(), 16), { animate: !calmo, duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, estado, temSelecionado]);

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

  // Áreas (distritos): pintadas pela faixa do valor; a escolhida ganha contorno forte e as outras somem.
  // Ao escolher uma área, o mapa voa até ela; sem área escolhida, enquadra a cidade toda.
  const areasGeo = areas?.geojson, areasValores = areas?.valores, areaSel = areas?.selecionada ?? null;
  useEffect(() => {
    const m = mapa.current, l = lib.current;
    if (estado !== "pronto" || !m || !l) return;
    camadaAreas.current?.remove();
    camadaAreas.current = null;
    const a = cb.current.areas;
    if (!a || !areasGeo) return;
    const destaque = lerCor("--qr-destaque");
    const linha = lerCor("--qr-line-strong");
    const tinta = lerCor("--qr-ink");
    const g = l.geoJSON(areasGeo, {
      style: (f) => {
        const id = String(f?.properties?.id);
        const sel = areaSel === id;
        const apagada = !!areaSel && !sel;
        return {
          color: sel ? tinta : linha, weight: sel ? 3 : 0.8, opacity: apagada ? 0.35 : 0.9,
          fillColor: destaque, fillOpacity: apagada ? 0.02 : OPACIDADE_FAIXA[faixaDe(a.valores[id] ?? 0, a.faixas)],
        };
      },
      onEachFeature: (f, camadaF) => {
        const id = String(f.properties?.id);
        camadaF.bindTooltip(cb.current.areas?.rotuloDe(id) ?? id, { sticky: true, direction: "top", className: "qr-dica" });
        camadaF.on("click", () => cb.current.areas?.aoEscolher?.(id));
      },
    }).addTo(m);
    g.bringToBack();
    camadaAreas.current = g;
    // Só voa quando a área escolhida muda (atualizar os números ou trocar o tema não mexe na vista).
    const chaveVista = areaSel ?? "";
    if (ultimaVista.current !== chaveVista) {
      ultimaVista.current = chaveVista;
      // Chegou com um ponto já escolhido (ex.: "Ver no mapa" da fila): fica nele, não volta para a cidade inteira.
      if (!areaSel && cb.current.selecionado) return;
      const achadas: Leaflet.Polygon[] = [];
      g.eachLayer((x) => { if ((x as Leaflet.Polygon & { feature?: import("geojson").Feature }).feature?.properties?.id === areaSel) achadas.push(x as Leaflet.Polygon); });
      const limites = achadas[0] ? achadas[0].getBounds() : g.getBounds();
      if (limites.isValid()) m.flyToBounds(limites, { padding: [24, 24], maxZoom: 15, duration: 0.6 });
    }
  }, [estado, areasGeo, areasValores, areaSel, tema]);

  // Pino fixo: quando o ponto muda por fora (busca de endereço, "minha localização"), o mapa vai até ele.
  const centroLat = centro?.lat, centroLon = centro?.lon;
  useEffect(() => {
    const m = mapa.current;
    if (estado !== "pronto" || !m || centroLat === undefined || centroLon === undefined) return;
    const c = m.getCenter();
    if (Math.abs(c.lat - centroLat) > 1e-5 || Math.abs(c.lng - centroLon) > 1e-5) m.setView([centroLat, centroLon], Math.max(m.getZoom(), 17));
  }, [estado, centroLat, centroLon]);

  if (estado === "falhou") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface-raised px-4 py-4 text-sm">
        <MapPinOff aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        <div className="grid gap-0.5">
          <strong className="font-semibold">Mapa indisponível agora</strong>
          <span className="text-ink-muted">
            Não deu para carregar o mapa.{pino || centro ? " Procure o endereço pelo nome ou use a localização do aparelho." : " A lista abaixo mostra as mesmas ocorrências."}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={`grid gap-1.5 ${altura === "100%" ? "h-full grid-rows-[1fr_auto]" : ""}`}>
      <div className="relative overflow-hidden rounded-card bg-surface-raised" style={altura === "100%" ? undefined : { height: altura }}>
        <div ref={ref} role="region" aria-label={rotulo} className="qr-mapa size-full" />
        {centro && estado === "pronto" && <PinoFixo />}
        {estado === "carregando" && <p role="status" className="absolute inset-0 z-[500] grid place-items-center text-sm text-ink-muted">Carregando o mapa…</p>}
      </div>
      {semFundo && (
        <p role="status" className={centro ? "text-base text-ink-muted" : "text-xs text-ink-muted"}>
          {centro ? "O mapa de fundo não carregou (sem internet?). Procure o endereço pelo nome, acima." : "O mapa de fundo não carregou (sem internet?). Os pontos continuam aqui e na lista."}
        </p>
      )}
    </div>
  );
}

/** Pino desenhado por cima do mapa, com a ponta exatamente no centro (o ponto que vai no reporte). */
function PinoFixo() {
  return (
    <svg aria-hidden="true" width="40" height="48" viewBox="0 0 40 48"
      className="pointer-events-none absolute top-1/2 left-1/2 z-[450] -translate-x-1/2 -translate-y-full drop-shadow-md">
      <path d="M20 46C20 46 4 30 4 18a16 16 0 0 1 32 0c0 12-16 28-16 28Z" fill="var(--qr-destaque)" stroke="#fff" strokeWidth="3" />
      <circle cx="20" cy="18" r="6" fill="#fff" />
    </svg>
  );
}

/** Legenda escrita do mapa (a forma e a cor sempre com palavra). `bolhas`: tamanhos de exemplo; `faixas`: tons dos bairros. */
export function LegendaMapa({ comTrajeto = false, bolhas = false, faixas }: { comTrajeto?: boolean; bolhas?: boolean; faixas?: number[] }) {
  const forma = (d: string) => <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-ink-muted stroke-surface-raised stroke-2">{d === "c" ? <circle cx="12" cy="12" r="8.5" /> : d === "q" ? <rect x="4" y="4" width="16" height="16" rx="2" /> : <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />}</svg>;
  const cor = (c: string, t: string) => <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-3 rounded-full ${c}`} />{t}</span>;
  const textoFaixa = (i: number) => !faixas ? "" : i === 0 ? `${faixas[0]}` : i < faixas.length ? `${faixas[i - 1] + 1}–${faixas[i]}` : `${faixas[faixas.length - 1] + 1} ou mais`;
  const linha = "flex flex-wrap items-center gap-x-4 gap-y-1";
  const nome = "w-16 shrink-0 font-semibold text-ink";
  return (
    <dl className="grid gap-1.5 text-xs text-ink-muted" aria-label="Legenda do mapa">
      <div className={linha}>
        <dt className={nome}>Cor</dt>
        <dd className={linha}>
          {cor("bg-danger", "Prioridade alta")}
          {cor("bg-warn", "Média")}
          {cor("bg-ok", "Baixa")}
          {cor("bg-ink-muted", "Resolvida")}
          {comTrajeto && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1 w-5 rounded-full bg-chart-1" />Trajeto do ônibus</span>}
        </dd>
      </div>
      {bolhas && (
        <div className={linha}>
          <dt className={nome}>Tamanho</dt>
          <dd className={linha}>
            {[1, 3, 8].map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block rounded-full bg-ink-muted" style={{ width: Math.min(22 * Math.sqrt(n), 64) * 0.5, height: Math.min(22 * Math.sqrt(n), 64) * 0.5 }} />
                {n} {n === 1 ? "reporte" : "reportes"}
              </span>
            ))}
          </dd>
        </div>
      )}
      <div className={linha}>
        <dt className={nome}>Forma</dt>
        <dd className={linha}>
          <span className="inline-flex items-center gap-1.5">{forma("c")}Cidadão</span>
          <span className="inline-flex items-center gap-1.5">{forma("q")}Ônibus</span>
          <span className="inline-flex items-center gap-1.5">{forma("l")}Os dois</span>
        </dd>
      </div>
      {faixas && (
        <div className={linha}>
          <dt className={nome}>Bairros</dt>
          <dd className={linha}>
            {OPACIDADE_FAIXA.map((op, i) => (
              <span key={op} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="relative inline-block size-3.5 overflow-hidden rounded-[3px] border border-line-strong">
                  <span className="absolute inset-0 bg-destaque" style={{ opacity: op }} />
                </span>
                {textoFaixa(i)}
              </span>
            ))}
            <span>problemas abertos</span>
          </dd>
        </div>
      )}
    </dl>
  );
}

export const tomDaOcorrencia = (o: { prioridade: number; status: string }): TomPonto =>
  o.status === "resolvida" || o.status === "possivelmente_resolvida" ? "neutro" : o.prioridade >= 4 ? "danger" : o.prioridade === 3 ? "warn" : "ok";

"use client";
// Mapa em tela cheia para escolher onde fica o problema (v1.1).
// O pino fica parado no meio; a pessoa arrasta o mapa, procura um endereço ou usa a localização do aparelho.
// Embaixo, o endereço do ponto atualiza sozinho ("Você está marcando: Rua Augusta, 912").
// <dialog> nativo: prende o foco, fecha com Esc e devolve o foco a quem abriu.
import { CircleAlert, LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { api, ErroAPI } from "@/providers/api";
import type { Endereco, Localizacao, ResultadoBusca } from "@/providers/tipos";
import { Botao } from "./Botao";
import { MapaOcorrencias } from "./MapaOcorrencias";
import { pedirPosicao, textoCoordenadas, textoEndereco, useEndereco } from "./useLocal";

const CENTRO_SP: Localizacao = { lat: -23.5505, lon: -46.6333 };
/** A mesma caixa da API (schemas.base.Localizacao): fora dela o reporte não é aceito. */
const semAssinatura = () => () => {};
export const dentroDeSP = (l: Localizacao) => l.lat >= -24.1 && l.lat <= -23.3 && l.lon >= -47.0 && l.lon <= -46.3;

export function FolhaMapa({ aberto, inicial, buscaPrimeiro = false, aoFechar, aoEscolher }: {
  aberto: boolean;
  inicial: Localizacao | null;
  /** Sem localização do aparelho: abre com o foco na busca de endereço. */
  buscaPrimeiro?: boolean;
  aoFechar: () => void;
  aoEscolher: (local: Localizacao, endereco: Endereco | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Portal no <body>: a folha tem a própria busca (<form>) e não pode ficar dentro do formulário do Reportar.
  const corpo = useSyncExternalStore(semAssinatura, () => document.body, () => null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto, corpo]);

  if (!corpo) return null;
  return createPortal(
    <dialog ref={ref} onClose={aoFechar} aria-labelledby="folha-mapa-titulo"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-scrim md:m-auto md:h-[90dvh] md:max-w-3xl">
      {aberto && <Conteudo inicial={inicial} buscaPrimeiro={buscaPrimeiro} aoFechar={aoFechar} aoEscolher={aoEscolher} />}
    </dialog>,
    corpo,
  );
}

function Conteudo({ inicial, buscaPrimeiro, aoFechar, aoEscolher }: {
  inicial: Localizacao | null; buscaPrimeiro: boolean; aoFechar: () => void; aoEscolher: (l: Localizacao, e: Endereco | null) => void;
}) {
  const [ponto, setPonto] = useState<Localizacao>(inicial ?? CENTRO_SP);
  const { endereco, falhou, buscando } = useEndereco(ponto, 450); // espera o mapa parar antes de perguntar
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [gps, setGps] = useState<"parado" | "buscando" | "negado" | "indisponivel">("parado");
  const [erroUsar, setErroUsar] = useState<string | null>(null);
  const busca = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { (buscaPrimeiro ? busca.current : titulo.current)?.focus(); }, [buscaPrimeiro]);

  const mover = (lat: number, lon: number) => {
    setPonto((p) => (Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lon - lon) < 1e-6 ? p : { lat, lon }));
    setErroUsar(null);
  };

  const procurar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // eventos do React sobem pelo portal até o formulário do Reportar
    const q = termo.trim();
    if (q.length < 3) { setErroBusca("Escreva pelo menos o nome da rua."); busca.current?.focus(); return; }
    setProcurando(true);
    setErroBusca(null);
    try {
      const r = await api.buscarEndereco(q);
      setResultados(r);
      if (!r.length) setErroBusca("Não achei esse endereço em São Paulo. Tente com o bairro ou arraste o mapa.");
    } catch (er) {
      setResultados(null);
      setErroBusca(er instanceof ErroAPI && er.tipo === "validacao" ? "Escreva pelo menos o nome da rua." : "Não consegui procurar agora. Arraste o mapa até o local.");
    } finally { setProcurando(false); }
  };

  const escolherResultado = (r: ResultadoBusca) => { setPonto({ lat: r.lat, lon: r.lon }); setResultados(null); setTermo(r.texto_curto); setErroUsar(null); };

  const minhaPosicao = async () => {
    setGps("buscando");
    const r = await pedirPosicao();
    if (typeof r === "string") { setGps(r); return; }
    setGps("parado");
    setPonto(r);
    setErroUsar(null);
  };

  const usar = () => {
    if (!dentroDeSP(ponto)) { setErroUsar("Esse ponto fica fora da Grande São Paulo. Arraste o mapa de volta."); return; }
    aoEscolher(ponto, endereco);
  };

  const fora = !dentroDeSP(ponto);
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr_auto] gap-3 bg-surface-solid p-4 md:rounded-panel md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="folha-mapa-titulo" ref={titulo} tabIndex={-1} className="text-[22px] leading-7 font-medium tracking-[-0.02em]">Onde fica o problema?</h2>
        <button type="button" onClick={aoFechar} aria-label="Fechar o mapa sem mudar o local"
          className="grid size-toque shrink-0 cursor-pointer place-items-center rounded-full hover:bg-rail-active/55">
          <X aria-hidden="true" className="size-6" />
        </button>
      </div>

      <div className="grid gap-2">
        <form role="search" onSubmit={procurar} className="flex gap-2">
          <label htmlFor="busca-endereco" className="sr-only">Procurar endereço</label>
          <input id="busca-endereco" ref={busca} value={termo} onChange={(e) => { setTermo(e.target.value); setErroBusca(null); }}
            placeholder="Procurar endereço (ex.: Rua Augusta, 900)" maxLength={120} autoComplete="street-address"
            aria-invalid={erroBusca ? true : undefined} aria-describedby={erroBusca ? "busca-erro" : undefined}
            className="min-h-toque w-full rounded-control border-[1.5px] border-line-strong bg-surface-raised px-4 text-[17px] placeholder:text-ink-muted" />
          <Botao type="submit" variante="secundario" icone={procurando ? LoaderCircle : Search} aria-busy={procurando} className="shrink-0">
            <span className="sr-only sm:not-sr-only">{procurando ? "Procurando…" : "Procurar"}</span>
          </Botao>
        </form>
        {erroBusca && <p id="busca-erro" role="alert" className="flex items-center gap-1.5 text-base font-semibold text-danger"><CircleAlert aria-hidden="true" className="size-[18px]" />{erroBusca}</p>}
        {resultados && resultados.length > 0 && (
          <ul aria-label="Endereços encontrados" className="grid max-h-56 gap-1 overflow-auto rounded-card bg-surface-raised p-1">
            {resultados.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" onClick={() => escolherResultado(r)}
                  className="flex min-h-toque w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-rail-active/55">
                  <MapPin aria-hidden="true" className="size-5 shrink-0 text-destaque" />
                  <span className="grid"><span className="font-semibold">{r.texto_curto}</span>
                    {(r.bairro || r.cidade) && <span className="text-base text-ink-muted">{[r.bairro, r.cidade].filter(Boolean).join(", ")}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative min-h-60">
        <MapaOcorrencias rotulo="Mapa: arraste até o pino ficar em cima do problema" altura="100%"
          centro={{ ...ponto, aoMover: mover }} />
      </div>

      <div className="grid gap-3">
        <p role="status" aria-live="polite" className="flex items-start gap-2 text-[17px]">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destaque" />
          <span>
            <span className="text-ink-muted">Você está marcando: </span>
            {fora ? <strong className="text-danger">fora da Grande São Paulo</strong>
              : buscando ? <span className="text-ink-muted">procurando o endereço…</span>
              : endereco ? <strong>{textoEndereco(endereco)}</strong>
              : <strong>{textoCoordenadas(ponto)}</strong>}
            {!fora && falhou && !buscando && <span className="block text-base text-ink-muted">Não achei o nome da rua, mas o ponto vai certinho para o órgão.</span>}
          </span>
        </p>
        {erroUsar && <p role="alert" className="flex items-center gap-1.5 text-base font-semibold text-danger"><CircleAlert aria-hidden="true" className="size-[18px]" />{erroUsar}</p>}
        {(gps === "negado" || gps === "indisponivel") && (
          <p role="status" className="text-base text-ink-muted">
            {gps === "negado" ? "A localização do aparelho não foi liberada." : "Não consegui a localização do aparelho."} Procure o endereço ou arraste o mapa.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <Botao variante="secundario" icone={gps === "buscando" ? LoaderCircle : LocateFixed} onClick={minhaPosicao} aria-busy={gps === "buscando"}>
            {gps === "buscando" ? "Procurando você…" : "Minha localização"}
          </Botao>
          <Botao icone={MapPin} bloco onClick={usar}>Usar este local</Botao>
        </div>
      </div>
    </div>
  );
}

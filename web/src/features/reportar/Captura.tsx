"use client";
// Etapa 1 · Captura: o que está acontecendo (texto ou ditado) + foto opcional + local.
import { ArrowRight, CircleCheck, LocateFixed, MapPinned, Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoTexto } from "@/ui/CampoTexto";
import { FotoEntrada } from "@/ui/FotoEntrada";
import { MapaOcorrencias } from "@/ui/MapaOcorrencias";
import { useDitado } from "@/ui/useVoz";
import type { Localizacao } from "@/providers/tipos";

type EstadoLocal = "parado" | "buscando" | "ok" | "mapa" | "negado" | "indisponivel";
const CENTRO_SP: Localizacao = { lat: -23.5505, lon: -46.6333 };

const contarLetras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

export function Captura({ descricao, referencia, local, previa, preparandoFoto, erroFoto, vozAuto, aoMudar, aoFoto, aoRemoverFoto, aoContinuar }: {
  descricao: string; referencia: string; local: Localizacao | null;
  previa: string | null; preparandoFoto: boolean; erroFoto: string | null; vozAuto: boolean;
  aoMudar: (p: { descricao?: string; referencia?: string; local?: Localizacao | null }) => void;
  aoFoto: (f: File) => void; aoRemoverFoto: () => void; aoContinuar: () => void;
}) {
  const [erroDescricao, setErroDescricao] = useState<string | null>(null);
  const [erroReferencia, setErroReferencia] = useState<string | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocal>(local ? "ok" : "parado");
  const [ajustando, setAjustando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const textoAtual = useRef(descricao);
  useEffect(() => { textoAtual.current = descricao; }, [descricao]);

  const ditado = useDitado((trecho) => {
    const base = textoAtual.current.trim();
    aoMudar({ descricao: base ? `${base} ${trecho}` : trecho });
    setErroDescricao(null);
  });

  // Veio do botão "Falar" da tela inicial: já liga o microfone.
  const ligouAuto = useRef(false);
  useEffect(() => {
    if (vozAuto && ditado.suportado && !ligouAuto.current) { ligouAuto.current = true; ditado.iniciar(); }
  }, [vozAuto, ditado]);

  const pegarLocal = () => {
    if (!("geolocation" in navigator)) { setEstadoLocal("indisponivel"); return; }
    setEstadoLocal("buscando");
    navigator.geolocation.getCurrentPosition(
      (p) => { aoMudar({ local: { lat: p.coords.latitude, lon: p.coords.longitude } }); setEstadoLocal("ok"); setErroReferencia(null); },
      (e) => setEstadoLocal(e.code === e.PERMISSION_DENIED ? "negado" : "indisponivel"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const continuar = (e: React.FormEvent) => {
    e.preventDefault();
    let ok = true;
    if (contarLetras(descricao) < 5) {
      setErroDescricao("Conte um pouco mais: o que é e onde fica.");
      campo.current?.focus();
      ok = false;
    }
    if (!local && referencia.trim().length < 3) {
      setErroReferencia("Use sua localização ou escreva a rua ou um ponto de referência.");
      if (ok) document.getElementById("referencia")?.focus();
      ok = false;
    }
    if (ok) aoContinuar();
  };

  const semLocal = estadoLocal === "negado" || estadoLocal === "indisponivel";
  const marcarNoMapa = (lat: number, lon: number) => { aoMudar({ local: { lat, lon } }); setEstadoLocal("mapa"); setErroReferencia(null); };
  const microfone = ditado.suportado === false ? null : (
    <button type="button" onClick={ditado.ouvindo ? ditado.parar : ditado.iniciar}
      aria-label={ditado.ouvindo ? "Parar de ouvir" : "Ditar com o microfone"} aria-pressed={ditado.ouvindo}
      className={`grid size-toque shrink-0 cursor-pointer place-items-center rounded-control ${ditado.ouvindo ? "bg-danger text-on-emergency" : "bg-primary text-primary-foreground hover:bg-brand-hover"}`}>
      {ditado.ouvindo ? <MicOff aria-hidden="true" className="size-6" /> : <Mic aria-hidden="true" className="size-6" />}
    </button>
  );

  return (
    <form noValidate onSubmit={continuar} className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">O que está acontecendo?</h1>
        <p className="text-ink-muted">Escreva ou fale. A gente descobre quem resolve.</p>
      </div>

      <div className="grid gap-2">
        <CampoTexto ref={campo} id="descricao" multilinha obrigatorio rotulo="Descreva o problema" maxLength={1000}
          dica="Ex.: buraco grande na rua, perto do ponto de ônibus" value={descricao} erro={erroDescricao ?? undefined}
          onChange={(e) => { aoMudar({ descricao: e.target.value }); if (erroDescricao) setErroDescricao(null); }}
          lateral={microfone} />
        {ditado.ouvindo && <p role="status" className="flex items-center gap-2 font-semibold text-destaque"><Mic aria-hidden="true" className="size-5" />Estou ouvindo… fale o problema.</p>}
        {ditado.erro && <p role="alert" className="text-base text-ink-muted">{ditado.erro}</p>}
        {ditado.suportado === false && (
          <p className="text-base text-ink-muted">Este navegador não tem ditado. Você pode digitar normalmente (ou usar o microfone do teclado do celular).</p>
        )}
      </div>

      <FotoEntrada previa={previa} ocupado={preparandoFoto} erro={erroFoto} aoEscolher={aoFoto} aoRemover={aoRemoverFoto} />

      <div className="grid gap-3">
        <p className="text-[17px] font-semibold">Onde fica?</p>
        {(estadoLocal === "ok" || estadoLocal === "mapa") && local ? (
          <p role="status" className="flex items-center gap-2 font-semibold text-ok"><CircleCheck aria-hidden="true" className="size-5" />
            {estadoLocal === "mapa" ? "Local marcado no mapa" : "Localização pega pelo aparelho"}
          </p>
        ) : (
          <Botao variante="secundario" icone={LocateFixed} onClick={pegarLocal}>
            {estadoLocal === "buscando" ? "Procurando sua localização…" : "Usar minha localização"}
          </Botao>
        )}
        {ajustando ? (
          <div className="grid gap-2">
            <p className="text-base text-ink-muted">Arraste o pino ou toque no mapa onde fica o problema.</p>
            <MapaOcorrencias rotulo="Mapa para marcar o local do problema" altura={300}
              pino={{ ...(local ?? CENTRO_SP), aoMover: marcarNoMapa }} />
            <Botao variante="secundario" onClick={() => setAjustando(false)}>Pronto, o local está certo</Botao>
          </div>
        ) : (
          <Botao variante="secundario" icone={MapPinned} onClick={() => setAjustando(true)}>
            {local ? "Ajustar no mapa" : "Marcar no mapa"}
          </Botao>
        )}
        {semLocal && (
          <Aviso tipo="warn" titulo="Não consegui sua localização">
            {estadoLocal === "negado" ? "A permissão foi negada. " : ""}Escreva a rua ou um ponto de referência abaixo. No mapa, o reporte fica no centro de SP.
          </Aviso>
        )}
        <CampoTexto id="referencia" rotulo={semLocal || !local ? "Rua ou ponto de referência" : "Rua ou ponto de referência (opcional)"}
          dica="Ex.: Rua Augusta, 900, em frente à padaria" value={referencia} erro={erroReferencia ?? undefined} maxLength={200}
          onChange={(e) => { aoMudar({ referencia: e.target.value }); if (erroReferencia) setErroReferencia(null); }} />
      </div>

      <Botao type="submit" icone={ArrowRight} bloco className="min-h-16! text-xl!">Descobrir quem resolve</Botao>
    </form>
  );
}

"use client";
// Etapa 1 · Captura (v1.1): três cartões com o que já temos (o que você viu, foto, local).
// Sem cara de formulário: o local vem sozinho, com o endereço por extenso, e só se pede o que falta.
import { ArrowRight, CircleAlert, LoaderCircle, MapPinned, Mic, Search, Square } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoTexto } from "@/ui/CampoTexto";
import { FolhaMapa } from "@/ui/FolhaMapa";
import { FotoEntrada } from "@/ui/FotoEntrada";
import { pedirPosicao, textoCoordenadas, textoEndereco, useEndereco } from "@/ui/useLocal";
import { useDitado } from "@/ui/useVoz";
import type { Localizacao } from "@/providers/tipos";

type FaseLocal = "parado" | "buscando" | "ok" | "negado" | "indisponivel";
type OrigemLocal = "aparelho" | "mapa";

const contarLetras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

export function Captura({ descricao, local, endereco, previa, preparandoFoto, erroFoto, inicio, aoMudar, aoFoto, aoRemoverFoto, aoContinuar }: {
  descricao: string; local: Localizacao | null; endereco: string | null;
  previa: string | null; preparandoFoto: boolean; erroFoto: string | null;
  /** Como a pessoa chegou da tela inicial: falando, escrevendo ou (foto/exemplo) direto. */
  inicio: "voz" | "escrever" | null;
  aoMudar: (p: { descricao?: string; local?: Localizacao | null; endereco?: string | null }) => void;
  aoFoto: (f: File) => void; aoRemoverFoto: () => void; aoContinuar: () => void;
}) {
  const [erroDescricao, setErroDescricao] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [faseLocal, setFaseLocal] = useState<FaseLocal>(local ? "ok" : "parado");
  const [origem, setOrigem] = useState<OrigemLocal>("aparelho");
  const [mapaAberto, setMapaAberto] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const botaoLocal = useRef<HTMLButtonElement>(null);
  const textoAtual = useRef(descricao);
  useEffect(() => { textoAtual.current = descricao; }, [descricao]);

  const ditado = useDitado((trecho) => {
    const base = textoAtual.current.trim();
    aoMudar({ descricao: base ? `${base} ${trecho}` : trecho });
    setErroDescricao(null);
  });

  // Veio da bola da tela inicial: já liga o microfone. Veio de "Escrever": foco no texto.
  const comecou = useRef(false);
  useEffect(() => {
    if (comecou.current || ditado.suportado === null) return;
    comecou.current = true;
    if (inicio === "voz" && ditado.suportado) ditado.iniciar();
    else if (inicio === "escrever" || (inicio === "voz" && !ditado.suportado)) campo.current?.focus();
  }, [inicio, ditado]);

  // Local automático: ao abrir o Reportar, pede a posição uma vez (é o momento em que faz sentido pedir).
  const pediu = useRef(false);
  useEffect(() => {
    if (pediu.current || local) return;
    pediu.current = true;
    setFaseLocal("buscando");
    pedirPosicao().then((r) => {
      if (typeof r === "string") { setFaseLocal(r); return; }
      aoMudar({ local: r, endereco: null });
      setOrigem("aparelho");
      setFaseLocal("ok");
    });
  }, [local, aoMudar]);

  // Endereço por extenso do ponto (só quando ainda não temos o texto).
  const { endereco: achado, falhou, buscando } = useEndereco(local && !endereco ? local : null);
  useEffect(() => { if (achado) aoMudar({ endereco: textoEndereco(achado) }); }, [achado, aoMudar]);

  const continuar = (e: React.FormEvent) => {
    e.preventDefault();
    let ok = true;
    if (contarLetras(descricao) < 5) {
      setErroDescricao("Conte um pouco mais: o que é e como está.");
      campo.current?.focus();
      ok = false;
    }
    if (!local) {
      setErroLocal("Falta dizer onde fica. Procure o endereço ou marque no mapa.");
      if (ok) botaoLocal.current?.focus();
      ok = false;
    }
    if (ok) { ditado.parar(); aoContinuar(); }
  };

  const semGps = faseLocal === "negado" || faseLocal === "indisponivel";
  const rotuloBola = ditado.ouvindo ? "Parar" : descricao.trim() ? "Falar mais" : "Falar";

  return (
    <form noValidate onSubmit={continuar} className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Novo reporte</h1>
              </div>

      <Cartao titulo="O que você viu" indice={0}>
        <CampoTexto ref={campo} id="descricao" multilinha obrigatorio rotuloOculto rotulo="Descreva o problema" maxLength={1000}
          placeholder="Ex.: buraco grande na rua, perto do ponto de ônibus" value={descricao} erro={erroDescricao ?? undefined}
          className={ditado.suportado ? "pb-16" : ""}
          dentro={ditado.suportado ? (
            <button type="button" onClick={ditado.ouvindo ? ditado.parar : ditado.iniciar} aria-pressed={ditado.ouvindo}
              className={`inline-flex min-h-toque cursor-pointer items-center gap-2 rounded-pill px-4 text-base font-semibold ${ditado.ouvindo ? "bg-danger text-on-emergency" : "bg-primary text-primary-foreground hover:bg-brand-hover"}`}>
              {ditado.ouvindo ? <Square aria-hidden="true" className="size-4" fill="currentColor" /> : <Mic aria-hidden="true" className="size-5" strokeWidth={1.75} />}
              {rotuloBola}
            </button>
          ) : undefined}
          onChange={(e) => { aoMudar({ descricao: e.target.value }); if (erroDescricao) setErroDescricao(null); }} />
        {ditado.ouvindo && <p role="status" className="text-base text-ink-muted">Estou ouvindo. Fale o problema.</p>}
        {ditado.erro && <p role="alert" className="text-base text-ink-muted">{ditado.erro}</p>}
        {ditado.suportado === false && (
          <p className="text-base text-ink-muted">Este navegador não tem ditado. Digite ou use o microfone do teclado.</p>
        )}
      </Cartao>

      <Cartao titulo="Foto" extra="opcional" indice={1}>
        <FotoEntrada comTitulo={false} previa={previa} ocupado={preparandoFoto} erro={erroFoto} aoEscolher={aoFoto} aoRemover={aoRemoverFoto} />
      </Cartao>

      <Cartao titulo="Local" indice={2}>
        {faseLocal === "buscando" && !local ? (
          <p role="status" className="flex items-center gap-2 text-[17px]">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-destaque motion-reduce:animate-none" />Procurando onde você está…
          </p>
        ) : local ? (
          <div className="grid gap-3">
            <p role="status" aria-live="polite" className="grid gap-0.5">
              <span className="text-base text-ink-muted">{origem === "mapa" ? "Você marcou no mapa" : "Você está em"}</span>
              <strong className="text-xl leading-7 font-semibold">
                {endereco ?? (buscando ? "Procurando o endereço…" : textoCoordenadas(local))}
              </strong>
              {!endereco && falhou && <span className="text-base text-ink-muted">Não achei o nome da rua, mas o ponto vai certinho para o órgão.</span>}
            </p>
            <Botao ref={botaoLocal} variante="secundario" icone={MapPinned} onClick={() => setMapaAberto(true)}>Ajustar no mapa</Botao>
          </div>
        ) : (
          <div className="grid gap-3">
            {semGps && (
              <Aviso tipo="warn" titulo="Não consegui sua localização">
                {faseLocal === "negado" ? "A permissão foi negada. " : ""}Procure o endereço ou marque o ponto no mapa.
              </Aviso>
            )}
            <Botao ref={botaoLocal} variante={semGps ? "primario" : "secundario"} icone={Search} onClick={() => setMapaAberto(true)}>
              Procurar endereço ou marcar no mapa
            </Botao>
          </div>
        )}
        {erroLocal && !local && (
          <p role="alert" className="flex items-center gap-1.5 text-base font-semibold text-danger"><CircleAlert aria-hidden="true" className="size-[18px]" />{erroLocal}</p>
        )}
      </Cartao>

      <Botao type="submit" icone={ArrowRight} bloco className="min-h-16! text-xl!">Descobrir quem resolve</Botao>

      <FolhaMapa aberto={mapaAberto} inicial={local} buscaPrimeiro={!local}
        aoFechar={() => setMapaAberto(false)}
        aoEscolher={(l, e) => {
          aoMudar({ local: l, endereco: textoEndereco(e) });
          setOrigem("mapa"); setFaseLocal("ok"); setErroLocal(null); setMapaAberto(false);
          setTimeout(() => botaoLocal.current?.focus(), 0);
        }} />
    </form>
  );
}

function Cartao({ titulo, extra, indice, children }: {
  titulo: string; extra?: string; indice: number; children: ReactNode;
}) {
  return (
    <section className="glass-card entrada grid gap-3 rounded-card p-5" style={{ "--i": indice } as React.CSSProperties} aria-label={titulo}>
      <h2 className="flex flex-wrap items-center gap-x-2 text-[17px] font-semibold">
        {titulo}{extra && <span className="font-normal text-ink-muted">({extra})</span>}
      </h2>
      {children}
    </section>
  );
}

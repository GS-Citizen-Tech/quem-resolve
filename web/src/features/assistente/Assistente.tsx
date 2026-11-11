"use client";
// Tirar dúvida: chat com o assistente RAG (fontes citadas, "não sei", "Isso ajudou?") e
// "Falar" (voz: STT → RAG → TTS). Guardrail nível 1/2 abre a tela de emergência no lugar da resposta.
import { Camera, Mic, RotateCcw, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { GuardrailResultado, Mensagem, RespostaAssistente } from "@/providers/tipos";
import { useAppState, type MensagemConversa } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoLink } from "@/ui/Botao";
import { CampoTexto } from "@/ui/CampoTexto";
import { Balao } from "@/ui/Conversa";
import { Carregando } from "@/ui/Estados";
import { TelaEmergencia } from "@/ui/TelaEmergencia";
import { useFala, useGravador } from "@/ui/useVoz";
import { Painel } from "@/ui/Vidro";
import { PainelVoz } from "./PainelVoz";
import { RespostaBalao, RodapeResposta } from "./RespostaBalao";

const EXEMPLOS = [
  "Quem conserta a calçada na frente de casa?",
  "Tem um fio pendurado na rua, quem eu chamo?",
  "Como peço a poda de uma árvore?",
  "A rua alagou, o que eu faço?",
];

interface Pendente { texto: string | null; via: "texto" | "voz"; erro: string | null; audio?: Blob }

/** Relógio para medir a latência da resposta (fica fora do componente: só roda nos eventos). */
const agora = () => performance.now();

const historicoDe = (c: MensagemConversa[]): Mensagem[] => c.map(({ papel, texto }) => ({ papel, texto }));

export function Assistente() {
  const { estado, despachar } = useAppState();
  const [texto, setTexto] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [emergencia, setEmergencia] = useState<GuardrailResultado | null>(null);
  const [modoVoz, setModoVoz] = useState(false);
  const [destacarVoz, setDestacarVoz] = useState(false);
  const fala = useFala();
  const fim = useRef<HTMLDivElement>(null);
  const conversa = estado.conversa;

  // Veio do "Falar" da tela inicial: já abre o modo voz.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("voz") === "1") {
      const t = setTimeout(() => { setModoVoz(true); setDestacarVoz(true); }, 0);
      return () => clearTimeout(t);
    }
  }, []);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [conversa.length, pendente]);

  const receber = (pergunta: string, r: RespostaAssistente, via: "texto" | "voz", latenciaMs: number) => {
    setPendente(null);
    if (r.guardrail && !r.guardrail.pode_continuar) { setEmergencia(r.guardrail); return; } // nível 1/2: não guarda nada
    despachar({ tipo: "mensagem", mensagem: { papel: "cidadao", texto: pergunta, via } });
    despachar({ tipo: "mensagem", mensagem: { papel: "assistente", texto: r.resposta, resposta: r, latenciaMs, via } });
  };

  const perguntar = async (p: string) => {
    const pergunta = p.trim();
    if ((pergunta.match(/\p{L}/gu) ?? []).length < 3) { setErroCampo("Escreva sua dúvida (pelo menos uma palavra)."); return; }
    setErroCampo(null);
    setTexto("");
    setPendente({ texto: pergunta, via: "texto", erro: null });
    const t0 = agora();
    try {
      const r = await api.perguntar(pergunta, historicoDe(conversa));
      receber(pergunta, r, "texto", agora() - t0);
    } catch (e) {
      setPendente({ texto: pergunta, via: "texto", erro: e instanceof ErroAPI ? e.mensagem : "Algo deu errado." });
    }
  };

  const tocar = (base64: string | null, falado: string) => {
    if (base64) {
      const a = new Audio(`data:audio/mpeg;base64,${base64}`);
      a.play().catch(() => fala.falar(falado));
    } else fala.falar(falado);
  };

  const enviarAudio = async (audio: Blob) => {
    setPendente({ texto: null, via: "voz", erro: null, audio });
    try {
      const r = await api.conversarPorVoz(audio, historicoDe(conversa));
      receber(r.transcricao, r.resposta, "voz", r.latencias.total_ate_fala_ms);
      if (r.resposta.guardrail?.pode_continuar !== false) tocar(r.audio_base64, r.texto_falado);
    } catch (e) {
      setPendente({ texto: null, via: "voz", erro: e instanceof ErroAPI && e.tipo !== "validacao" ? e.mensagem : "Não entendi o áudio. Tente de novo ou digite.", audio });
    }
  };
  const gravador = useGravador(enviarAudio);

  const tentarDeNovo = () => {
    if (!pendente) return;
    if (pendente.via === "voz" && pendente.audio) enviarAudio(pendente.audio);
    else if (pendente.texto) perguntar(pendente.texto);
  };

  const sairDaEmergencia = () => {
    if (emergencia) api.naoEEmergencia(emergencia.nivel, emergencia.tipo).catch(() => { /* registro anônimo */ });
    setEmergencia(null);
  };

  if (emergencia) {
    return <Painel><TelaEmergencia guardrail={emergencia} aoContinuar={sairDaEmergencia} rotuloContinuar="Não é uma emergência, voltar para a conversa" /></Painel>;
  }

  const enviando = !!pendente && !pendente.erro;
  const ultimaResposta = conversa.findLastIndex((m) => m.papel === "assistente");

  return (
    <Painel className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Tirar dúvida</h1>
          <p className="text-ink-muted">Pergunte sobre problemas de rua e serviços da cidade. Eu mostro de onde tirei a resposta.</p>
        </div>
        {conversa.length > 0 && (
          <Botao variante="link" icone={Trash2} onClick={() => { fala.parar(); despachar({ tipo: "limparConversa" }); }}>Limpar conversa</Botao>
        )}
      </div>

      {conversa.length === 0 && !pendente && (
        <div className="grid gap-2">
          <p className="font-semibold">Experimente perguntar:</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {EXEMPLOS.map((e) => (
              <li key={e}>
                <button type="button" onClick={() => perguntar(e)}
                  className="min-h-toque w-full cursor-pointer rounded-control px-4 py-2.5 text-left text-[17px] shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/45">
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(conversa.length > 0 || pendente) && (
        <ol className="grid gap-4" aria-label="Conversa" aria-live="polite">
          {conversa.map((m, i) => m.papel === "cidadao"
            ? <Balao key={i} de="cidadao" via={m.via}>{m.texto}</Balao>
            : (
              <Balao key={i} de="assistente"
                rodape={m.resposta && <RodapeResposta r={m.resposta} ultima={i === ultimaResposta} latenciaMs={m.latenciaMs} fala={fala} />}>
                {m.resposta ? <RespostaBalao r={m.resposta} /> : <p>{m.texto}</p>}
              </Balao>
            ))}
          {pendente && (
            <>
              <Balao de="cidadao" via={pendente.via}
                rodape={pendente.erro && (
                  <div className="grid max-w-[92%] justify-items-end gap-1">
                    <p role="alert" className="text-right font-semibold text-danger">Não enviada. {pendente.erro}</p>
                    <Botao variante="link" icone={RotateCcw} onClick={tentarDeNovo}>Tentar de novo</Botao>
                  </div>
                )}>
                {pendente.texto ?? "Áudio enviado"}
              </Balao>
              {!pendente.erro && (
                <li><Carregando texto={pendente.via === "voz" ? "Ouvindo e procurando a resposta…" : "Procurando nas fontes…"} /></li>
              )}
            </>
          )}
        </ol>
      )}
      <div ref={fim} />

      {pendente?.erro && (
        <Aviso tipo="info" titulo="Prefere falar com uma pessoa?">
          Ligue <a href="tel:156" className="font-semibold underline underline-offset-4">156</a> (SP156, da Prefeitura).
        </Aviso>
      )}

      {modoVoz && (
        <PainelVoz consentiu={estado.consentimentoVoz} aoConsentir={() => despachar({ tipo: "consentimentoVoz" })}
          aoRecusar={() => setModoVoz(false)} fase={gravador.fase} segundos={gravador.segundos} suportado={gravador.suportado}
          enviando={enviando && pendente?.via === "voz"} aoIniciar={() => { fala.parar(); gravador.iniciar(); }} aoParar={gravador.parar}
          destacado={destacarVoz} />
      )}

      <form noValidate onSubmit={(e) => { e.preventDefault(); if (!enviando) perguntar(texto); }} className="grid gap-3">
        <CampoTexto id="pergunta" rotulo="Sua pergunta" value={texto} maxLength={1000} erro={erroCampo ?? undefined}
          placeholder="Ex.: de quem é a responsabilidade pela calçada?" autoComplete="off"
          onChange={(e) => { setTexto(e.target.value); if (erroCampo) setErroCampo(null); }} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Botao type="submit" icone={Send} bloco aria-busy={enviando}>{enviando ? "Enviando…" : "Enviar"}</Botao>
          {!modoVoz && <Botao variante="secundario" icone={Mic} bloco onClick={() => setModoVoz(true)}>Falar</Botao>}
        </div>
      </form>

      <p className="flex flex-wrap items-center gap-x-2 text-ink-muted">
        Quer avisar um problema na rua?
        <BotaoLink href="/reportar" variante="link" icone={Camera} className="px-1! min-h-toque">Reportar</BotaoLink>
      </p>
    </Painel>
  );
}

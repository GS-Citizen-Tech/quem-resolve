"use client";
// Ditado (fala → texto) e leitura em voz alta (texto → fala) do próprio navegador.
// Base da tela de voz da F2. Sem servidor: nada de áudio sai do aparelho aqui.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface ReconhecimentoFala {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type Construtor = new () => ReconhecimentoFala;

function construtorDitado(): Construtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const semAssinatura = () => () => {};
/** true/false no navegador; null no servidor (ainda não sabemos). */
const useSuporte = (teste: () => boolean) => useSyncExternalStore(semAssinatura, teste, () => null);
const temDitado = () => construtorDitado() !== null;
const temFala = () => "speechSynthesis" in window;

/** Ditado do navegador. `aoFalar` recebe cada trecho final reconhecido. */
export function useDitado(aoFalar: (texto: string) => void) {
  const suportado = useSuporte(temDitado);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<ReconhecimentoFala | null>(null);
  const cb = useRef(aoFalar);
  useEffect(() => { cb.current = aoFalar; }, [aoFalar]);
  useEffect(() => () => rec.current?.stop(), []);

  const iniciar = useCallback(() => {
    const C = construtorDitado();
    if (!C) return;
    setErro(null);
    const r = new C();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
      }
    };
    r.onerror = (e) => {
      setErro(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "O microfone não foi liberado. Você pode liberar no navegador ou digitar."
        : e.error === "no-speech" ? "Não ouvi nada. Toque no microfone e fale de novo." : "O ditado falhou. Você pode digitar.");
    };
    r.onend = () => setOuvindo(false);
    rec.current = r;
    try { r.start(); setOuvindo(true); } catch { setOuvindo(false); }
  }, []);

  const parar = useCallback(() => { rec.current?.stop(); setOuvindo(false); }, []);
  return { suportado, ouvindo, erro, iniciar, parar };
}

/** Leitura em voz alta (speechSynthesis), em português. */
export function useFala() {
  const suportado = useSuporte(temFala) === true;
  const [falando, setFalando] = useState(false);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const falar = useCallback((texto: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
    if (voz) u.voice = voz;
    u.onend = () => setFalando(false);
    u.onerror = () => setFalando(false);
    setFalando(true);
    window.speechSynthesis.speak(u);
  }, []);
  const parar = useCallback(() => { window.speechSynthesis?.cancel(); setFalando(false); }, []);
  return { suportado, falando, falar, parar };
}

export type FaseGravacao = "parado" | "pedindo" | "gravando" | "negado" | "sem_suporte";
const temGravador = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
/** Formatos em ordem de preferência: webm/opus (Chrome, Android, Firefox) e mp4 (iPhone/Safari). */
const FORMATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Grava a fala do microfone (MediaRecorder) até `maxSegundos` e entrega o áudio em `aoTerminar`. */
export function useGravador(aoTerminar: (audio: Blob) => void, maxSegundos = 60) {
  const suportado = useSuporte(temGravador);
  const [fase, setFase] = useState<FaseGravacao>("parado");
  const [segundos, setSegundos] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(aoTerminar);
  useEffect(() => { cb.current = aoTerminar; }, [aoTerminar]);

  const limpar = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
  }, []);
  useEffect(() => () => limpar(), [limpar]);

  const parar = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const iniciar = useCallback(async () => {
    if (!temGravador()) { setFase("sem_suporte"); return; }
    setFase("pedindo");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setFase("negado");
      return;
    }
    const mimeType = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const partes: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    r.onstop = () => {
      const tipo = (r.mimeType || mimeType || "audio/webm").split(";")[0];
      limpar();
      setFase("parado");
      setSegundos(0);
      if (partes.length) cb.current(new Blob(partes, { type: tipo }));
    };
    rec.current = r;
    r.start();
    setSegundos(0);
    setFase("gravando");
    const inicio = Date.now();
    relogio.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= maxSegundos) r.stop();
    }, 250);
  }, [limpar, maxSegundos]);

  return { suportado, fase, segundos, iniciar, parar };
}

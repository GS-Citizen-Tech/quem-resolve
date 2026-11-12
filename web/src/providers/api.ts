// Cliente HTTP da API FastAPI (camada providers/). O front nunca fala com o LLM: tudo passa por aqui.
import type {
  AnaliseReporte, AtualizarStatus, Categoria, EventoSom, FeedbackEntrada, FiltrosOcorrencia, Mensagem,
  Metricas, Ocorrencia, OcorrenciaCriar, PassagemResumo, ReporteEntrada, Responsavel, RespostaAssistente,
  Qualidade, RespostaVoz, Saude, Sessao, VisaoResultado,
} from "./tipos";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

export type TipoErro = "offline" | "timeout" | "validacao" | "login" | "proibido" | "nao_encontrado" | "servidor" | "invalida";

/** Erro com mensagem pronta para mostrar ao cidadão (nunca o detalhe técnico). */
export class ErroAPI extends Error {
  constructor(public mensagem: string, public tipo: TipoErro) {
    super(mensagem);
  }
}

let tokenGestor: string | null = null;
/** O estado central chama isto ao fazer login/logout do gestor. */
export function definirToken(t: string | null) { tokenGestor = t; }

async function req<T>(caminho: string, init: RequestInit = {}, limiteMs = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limiteMs);
  const headers = new Headers(init.headers);
  if (tokenGestor) headers.set("Authorization", `Bearer ${tokenGestor}`);
  let r: Response;
  try {
    r = await fetch(`${BASE}${caminho}`, { ...init, headers, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ErroAPI("Está demorando mais que o normal. Tente de novo em instantes.", "timeout");
    throw new ErroAPI("Não conseguimos falar com o servidor agora. Confira sua internet ou escolha a categoria na lista.", "offline");
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null);
    const detalhe = typeof corpo?.detail === "string" ? corpo.detail : null; // mensagens da API já são amigáveis
    if (r.status === 401) throw new ErroAPI(detalhe ?? "Faça login para continuar.", "login");
    if (r.status === 403) throw new ErroAPI(detalhe ?? "Você não tem permissão para isso.", "proibido");
    if (r.status === 404) throw new ErroAPI(detalhe ?? "Não encontramos o que você procurou.", "nao_encontrado");
    if (r.status === 413 || r.status === 415) throw new ErroAPI(detalhe ?? "Arquivo não aceito.", "validacao");
    if (r.status === 422) throw new ErroAPI("Algum campo não está certo. Confira e tente de novo.", "validacao");
    throw new ErroAPI("Tivemos um problema do nosso lado. Tente de novo em instantes.", "servidor");
  }
  if (r.status === 204) return undefined as T;
  try {
    return (await r.json()) as T;
  } catch {
    throw new ErroAPI("Recebemos uma resposta inesperada. Tente de novo.", "invalida");
  }
}

const json = (corpo: unknown, method = "POST"): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
});

const qs = (p: object) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};

// Cache em memória para dados que quase não mudam: evita repetir chamadas a cada tela.
const cache = new Map<string, Promise<unknown>>();
function comCache<T>(chave: string, f: () => Promise<T>): Promise<T> {
  if (!cache.has(chave)) cache.set(chave, f().catch((e) => { cache.delete(chave); throw e; }));
  return cache.get(chave) as Promise<T>;
}

export const api = {
  // A · base e K · saúde
  saude: () => req<Saude>("/health"),
  categorias: () => comCache("categorias", () => req<Categoria[]>("/categorias")),
  responsaveis: () => comCache("responsaveis", () => req<Responsavel[]>("/responsaveis")),

  // C · visão · D · análise · B · guardrail
  detectarFoto: (foto: File) => {
    const fd = new FormData();
    fd.append("foto", foto);
    return req<VisaoResultado>("/visao/detectar", { method: "POST", body: fd });
  },
  analisar: (e: ReporteEntrada) => req<AnaliseReporte>("/reportes/analisar", json(e)),
  naoEEmergencia: (nivel: number, tipo: string | null) =>
    req<void>(`/guardrail/nao-e-emergencia${qs({ nivel, tipo: tipo ?? undefined })}`, { method: "POST" }),

  // E · ocorrências · F · métricas
  criarOcorrencia: (o: OcorrenciaCriar) => req<Ocorrencia>("/ocorrencias", json(o)),
  ocorrencias: (f: FiltrosOcorrencia = {}) => req<Ocorrencia[]>(`/ocorrencias${qs(f)}`),
  ocorrencia: (id: string) => req<Ocorrencia>(`/ocorrencias/${encodeURIComponent(id)}`),
  metricas: (f: Omit<FiltrosOcorrencia, "status"> = {}) => req<Metricas>(`/ocorrencias/metricas${qs(f)}`),
  atualizarOcorrencia: (id: string, d: AtualizarStatus) => req<Ocorrencia>(`/ocorrencias/${id}/status`, json(d, "PATCH")),

  // G · assistente · H · voz
  perguntar: (pergunta: string, historico: Mensagem[]) => req<RespostaAssistente>("/assistente/perguntar", json({ pergunta, historico })),
  conversarPorVoz: (audio: Blob, historico: Mensagem[]) => {
    const fd = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
    fd.append("audio", audio, `fala.${ext}`);
    fd.append("historico", JSON.stringify(historico));
    return req<RespostaVoz>("/voz/conversar", { method: "POST", body: fd }, 30_000); // STT + RAG + TTS
  },

  // I · frota · J · IoT
  passagens: () => req<Record<string, PassagemResumo>>("/frota/passagens"),
  eventosSom: (limite = 5) => req<EventoSom[]>(`/iot/eventos?limite=${limite}`),

  // L · feedback · M · login
  feedback: (f: FeedbackEntrada) => req<{ id: string }>("/feedback", json(f)),
  login: (usuario: string, senha: string) => req<Sessao>("/auth/login", json({ usuario, senha })),
  qualidade: () => req<Qualidade>("/qualidade"),
  registrosGuardrail: () => req<Record<string, unknown>[]>("/guardrail/registros"),
};

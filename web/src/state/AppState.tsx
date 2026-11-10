"use client";
// Estado centralizado (camada state/). Fica salvo no aparelho, sem cadastro:
// tema, histórico de reportes do cidadão e conversa com o assistente.
// A sessão do gestor fica só na aba (sessionStorage) e expira sozinha.
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { definirToken } from "@/providers/api";
import type { Mensagem, Ocorrencia, Sessao } from "@/providers/tipos";

export type Tema = "claro" | "escuro" | "alto-contraste";
export type ReporteSalvo = Pick<Ocorrencia, "id" | "protocolo" | "categoria_final" | "responsavel_id" | "criada_em" | "status">;

export interface Estado {
  tema: Tema;
  meusReportes: ReporteSalvo[];
  conversa: Mensagem[];
  sessao: Sessao | null;
  carregado: boolean;
}

export type Acao =
  | { tipo: "carregar"; dados: Partial<Estado> }
  | { tipo: "tema"; tema: Tema }
  | { tipo: "reporteEnviado"; ocorrencia: Ocorrencia }
  | { tipo: "statusAtualizado"; atualizados: Pick<Ocorrencia, "id" | "status" | "categoria_final" | "responsavel_id">[] }
  | { tipo: "mensagem"; mensagem: Mensagem }
  | { tipo: "limparConversa" }
  | { tipo: "login"; sessao: Sessao }
  | { tipo: "logout" };

const inicial: Estado = { tema: "claro", meusReportes: [], conversa: [], sessao: null, carregado: false };
const CHAVE_LOCAL = "quem-resolve:v1";
const CHAVE_SESSAO = "quem-resolve:gestor";

export function reducer(s: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case "carregar": return { ...s, ...a.dados, carregado: true };
    case "tema": return { ...s, tema: a.tema };
    case "reporteEnviado": {
      const { id, protocolo, categoria_final, responsavel_id, criada_em, status } = a.ocorrencia;
      const novo = { id, protocolo, categoria_final, responsavel_id, criada_em, status };
      return { ...s, meusReportes: [novo, ...s.meusReportes.filter((r) => r.id !== id)].slice(0, 50) };
    }
    case "statusAtualizado": {
      const mapa = new Map(a.atualizados.map((o) => [o.id, o]));
      return { ...s, meusReportes: s.meusReportes.map((r) => {
        const o = mapa.get(r.id);
        return o ? { ...r, status: o.status, categoria_final: o.categoria_final, responsavel_id: o.responsavel_id } : r;
      }) };
    }
    case "mensagem": return { ...s, conversa: [...s.conversa, a.mensagem].slice(-20) };
    case "limparConversa": return { ...s, conversa: [] };
    case "login": return { ...s, sessao: a.sessao };
    case "logout": return { ...s, sessao: null };
  }
}

const sessaoValida = (x: Sessao | null) => (x && new Date(x.expira_em).getTime() > Date.now() ? x : null);

const Ctx = createContext<{ estado: Estado; despachar: (a: Acao) => void } | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reducer, inicial);
  const carregou = useRef(false);

  useEffect(() => {
    if (carregou.current) return;
    carregou.current = true;
    let dados: Partial<Estado> = {};
    try {
      const local = localStorage.getItem(CHAVE_LOCAL);
      if (local) dados = JSON.parse(local);
    } catch { /* sem armazenamento: segue só em memória */ }
    try {
      const s = sessionStorage.getItem(CHAVE_SESSAO);
      dados.sessao = s ? sessaoValida(JSON.parse(s)) : null;
    } catch { dados.sessao = null; }
    despachar({ tipo: "carregar", dados });
  }, []);

  useEffect(() => {
    if (!estado.carregado) return;
    const { tema, meusReportes, conversa, sessao } = estado;
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ tema, meusReportes, conversa })); } catch { /* idem */ }
    try {
      if (sessao) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      else sessionStorage.removeItem(CHAVE_SESSAO);
    } catch { /* idem */ }
    definirToken(sessao?.token ?? null);
  }, [estado]);

  // Tema: classe "dark" ou data-theme="alto-contraste" no <html> (contrato do design system).
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", estado.tema === "escuro");
    if (estado.tema === "alto-contraste") html.dataset.theme = "alto-contraste";
    else delete html.dataset.theme;
  }, [estado.tema]);

  return <Ctx.Provider value={{ estado, despachar }}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppState precisa estar dentro do AppStateProvider");
  return c;
}

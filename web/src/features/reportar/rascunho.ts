// Estado do fluxo de reporte (rascunho). Fica no sessionStorage: recarregar a página
// não perde o que a pessoa escreveu. A foto fica só em memória.
import type { AnaliseReporte, Deteccao, Localizacao, Ocorrencia } from "@/providers/tipos";

export type Etapa = "captura" | "analisando" | "emergencia" | "resultado" | "confirmacao" | "protocolo";
export type Escolha = "ia" | "cidadao";

export interface Rascunho {
  etapa: Etapa;
  descricao: string;
  referencia: string;
  local: Localizacao | null;
  analise: AnaliseReporte | null;
  manual: "falha" | "nao_emergencia" | null; // escolha manual: API fora do ar ou "não é uma emergência"
  deteccoes: Deteccao[];
  avisoFoto: string | null;
  categoriaId: string | null;       // categoria que vai na solicitação
  escolha: Escolha;                 // quem decidiu a categoria
  ocorrencia: Ocorrencia | null;
}

export const RASCUNHO_VAZIO: Rascunho = {
  etapa: "captura", descricao: "", referencia: "", local: null, analise: null, manual: null, deteccoes: [],
  avisoFoto: null, categoriaId: null, escolha: "ia", ocorrencia: null,
};

const CHAVE = "quem-resolve:rascunho";

export function lerRascunho(): Rascunho | null {
  try {
    const s = sessionStorage.getItem(CHAVE);
    return s ? { ...RASCUNHO_VAZIO, ...JSON.parse(s) } : null;
  } catch { return null; }
}

export function salvarRascunho(r: Rascunho) {
  try {
    if (r.etapa === "emergencia") sessionStorage.removeItem(CHAVE); // nível 1/2: nada fica guardado
    else sessionStorage.setItem(CHAVE, JSON.stringify(r));
  } catch { /* sem armazenamento: segue em memória */ }
}

export function apagarRascunho() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* idem */ }
}

/** Etapa a partir da URL (?etapa=…), para o botão voltar do navegador. */
export function etapaDaUrl(): Etapa {
  const e = new URLSearchParams(window.location.search).get("etapa");
  return e === "resultado" || e === "confirmacao" || e === "protocolo" || e === "emergencia" ? e : "captura";
}

/** Uma etapa só é válida se houver os dados que ela precisa. */
export function etapaValida(e: Etapa, r: Rascunho): boolean {
  switch (e) {
    case "captura": return true;
    case "analisando": return false;
    case "emergencia": return r.analise !== null && !r.analise.guardrail.pode_continuar;
    case "resultado": return r.descricao.length > 0 && !r.ocorrencia && (r.manual !== null || r.analise?.guardrail.pode_continuar === true);
    case "confirmacao": return r.categoriaId !== null && !r.ocorrencia;
    case "protocolo": return r.ocorrencia !== null;
  }
}

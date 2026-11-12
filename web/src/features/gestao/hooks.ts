"use client";
// Ganchos do console: busca de dados por tela, filtros na URL e nomes da base.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { Categoria, FiltrosOcorrencia, Origem, Responsavel, Status } from "@/providers/tipos";

// ---------- Busca por tela ----------

interface EstadoConsulta<T> { dados: T | null; erro: ErroAPI | null; carregando: boolean; versao: number }
type AcaoConsulta<T> = { tipo: "inicio" } | { tipo: "ok"; dados: T } | { tipo: "erro"; erro: ErroAPI } | { tipo: "recarregar" };

function redutor<T>(s: EstadoConsulta<T>, a: AcaoConsulta<T>): EstadoConsulta<T> {
  switch (a.tipo) {
    case "inicio": return { ...s, carregando: true };
    case "ok": return { dados: a.dados, erro: null, carregando: false, versao: s.versao };
    case "erro": return { ...s, erro: a.erro, carregando: false };
    case "recarregar": return { ...s, versao: s.versao + 1 };
  }
}

/**
 * Sessão expirada (401): vai para Entrar com o aviso, guardando a tela atual para voltar depois.
 * Quem apaga a sessão é a tela Entrar (se apagasse aqui, a guarda do layout redirecionaria antes, sem o aviso).
 */
export function useSairPorExpiracao() {
  const router = useRouter();
  return useCallback(() => {
    const volta = window.location.pathname + window.location.search;
    router.replace(`/gestao/entrar?expirou=1&volta=${encodeURIComponent(volta)}`);
  }, [router]);
}

/**
 * Busca os dados de uma tela. Refaz quando `chave` muda, em "Atualizar" e quando a aba volta ao foco.
 * Em caso de erro, os dados anteriores continuam na tela (os filtros não se perdem).
 */
export function useConsulta<T>(buscar: () => Promise<T>, chave: string) {
  const [s, despachar] = useReducer(redutor<T>, { dados: null, erro: null, carregando: true, versao: 0 });
  const expirou = useSairPorExpiracao();
  const ref = useRef(buscar);
  useEffect(() => { ref.current = buscar; });

  useEffect(() => {
    let vivo = true;
    despachar({ tipo: "inicio" });
    ref.current()
      .then((d) => vivo && despachar({ tipo: "ok", dados: d }))
      .catch((e: unknown) => {
        if (!vivo) return;
        const erro = e instanceof ErroAPI ? e : new ErroAPI("Tivemos um problema do nosso lado. Tente de novo em instantes.", "servidor");
        if (erro.tipo === "login") expirou();
        else despachar({ tipo: "erro", erro });
      });
    return () => { vivo = false; };
  }, [chave, s.versao, expirou]);

  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") despachar({ tipo: "recarregar" }); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  const atualizar = useCallback(() => despachar({ tipo: "recarregar" }), []);
  return { ...s, atualizar };
}

// ---------- Filtros na URL ----------

export type ChaveFiltro = "categoria" | "responsavel" | "origem" | "status";
export const CHAVES_FILTRO: ChaveFiltro[] = ["categoria", "responsavel", "origem", "status"];

/** Filtros guardados na URL (?categoria=buraco): trocar de tela mantém o filtro e o link pode ser compartilhado. */
export function useFiltros() {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const filtros = useMemo<FiltrosOcorrencia>(() => ({
    categoria: params.get("categoria") ?? undefined,
    responsavel: params.get("responsavel") ?? undefined,
    origem: (params.get("origem") as Origem | null) ?? undefined,
    status: (params.get("status") as Status | null) ?? undefined,
  }), [params]);

  const definir = useCallback((chave: ChaveFiltro, valor: string | undefined) => {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(chave, valor); else p.delete(chave);
    p.delete("abrir");
    const q = p.toString();
    router.replace(q ? `${caminho}?${q}` : caminho, { scroll: false });
  }, [params, router, caminho]);

  const limpar = useCallback(() => router.replace(caminho, { scroll: false }), [router, caminho]);

  /** "?categoria=…" só com os filtros (para os links do trilho e do dock). */
  const sufixo = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of CHAVES_FILTRO) { const v = params.get(k); if (v) p.set(k, v); }
    const q = p.toString();
    return q ? `?${q}` : "";
  }, [params]);

  /** Filtros para mandar à API: aplica os padrões da tela e troca "todos" por nenhum filtro. */
  const consulta = useCallback((padroes: Partial<Record<ChaveFiltro, string>> = {}): FiltrosOcorrencia => {
    const f: Record<string, string | undefined> = {};
    for (const k of CHAVES_FILTRO) {
      const v = filtros[k] ?? padroes[k];
      f[k] = v && v !== "todos" ? v : undefined;
    }
    return f as FiltrosOcorrencia;
  }, [filtros]);

  const ativos = CHAVES_FILTRO.filter((k) => filtros[k]).length;
  return { filtros, definir, limpar, sufixo, ativos, consulta, abrir: params.get("abrir") };
}

// ---------- Nomes da base (categorias e órgãos) ----------

interface Base { categorias: Categoria[]; responsaveis: Responsavel[] }
const VAZIA: Base = { categorias: [], responsaveis: [] };

export function useBase() {
  const { dados } = useConsulta<Base>(
    () => Promise.all([api.categorias(), api.responsaveis()]).then(([categorias, responsaveis]) => ({ categorias, responsaveis })),
    "base",
  );
  const base = dados ?? VAZIA;
  return useMemo(() => {
    const cat = new Map(base.categorias.map((c) => [c.id, c]));
    const org = new Map(base.responsaveis.map((r) => [r.id, r]));
    return {
      ...base,
      nomeCategoria: (id: string | null | undefined) => (id ? cat.get(id)?.nome ?? id : "Sem categoria"),
      nomeOrgao: (id: string | null | undefined) => (id ? org.get(id)?.nome ?? id : "—"),
    };
  }, [base]);
}

// ---------- Textos comuns ----------

export const NOME_ORIGEM: Record<Origem, string> = { cidadao: "Cidadão", frota: "Ônibus", ambos: "Cidadão + ônibus" };
export const NOME_STATUS: Record<Status, string> = {
  pendente_envio: "Aguardando envio",
  enviada: "Enviada ao órgão",
  possivelmente_resolvida: "Possivelmente resolvida",
  resolvida: "Resolvida",
};

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const dataCurta = (iso: string) => fmtData.format(new Date(iso));
export const pct = (v: number, casas = 0) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
export const coord = (lat: number, lon: number) => `${lat.toFixed(4).replace(".", ",")}; ${lon.toFixed(4).replace(".", ",")}`;

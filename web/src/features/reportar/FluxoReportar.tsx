"use client";
// Fluxo do cidadão numa rota só (/reportar), com as etapas no estado.
// captura → analisando → (emergência) → resultado / "Não é isso" → confirmação → protocolo.
// O botão voltar do navegador volta uma etapa (?etapa=… na URL).
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { api, ErroAPI } from "@/providers/api";
import { BASE_RESERVA, carregarBase, CENTRO_SP, type BaseQuemResolve } from "@/providers/base";
import type { Categoria, Deteccao } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";
import { Carregando } from "@/ui/Estados";
import { ErroFoto, prepararFoto } from "@/ui/FotoEntrada";
import { Painel } from "@/ui/Vidro";
import { Captura } from "./Captura";
import { Confirmacao } from "./Confirmacao";
import { Emergencia } from "./Emergencia";
import { Protocolo } from "./Protocolo";
import { Resultado } from "./Resultado";
import {
  apagarRascunho, etapaDaUrl, etapaValida, lerRascunho, RASCUNHO_VAZIO, salvarRascunho, type Etapa, type Rascunho,
} from "./rascunho";

const urlDa = (e: Etapa) => (e === "captura" || e === "analisando" ? "/reportar" : `/reportar?etapa=${e}`);

export function FluxoReportar() {
  const { despachar } = useAppState();
  const [r, setR] = useReducer((x: Rascunho, f: Rascunho | ((x: Rascunho) => Rascunho)) => (typeof f === "function" ? f(x) : f), RASCUNHO_VAZIO);
  const [{ pronto, vozAuto }, iniciou] = useReducer((_: { pronto: boolean; vozAuto: boolean }, n: { pronto: boolean; vozAuto: boolean }) => n, { pronto: false, vozAuto: false });
  const [base, setBase] = useState<BaseQuemResolve>(BASE_RESERVA);
  const [foto, setFoto] = useState<{ arquivo: File; url: string } | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [passo, setPasso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const titulo = useRef<HTMLParagraphElement>(null);
  const rRef = useRef(r);
  useEffect(() => { rRef.current = r; }, [r]);

  // Restaura o rascunho (recarregar não perde nada) e carrega a base (ou a reserva embutida).
  useEffect(() => {
    const salvo = lerRascunho() ?? RASCUNHO_VAZIO;
    const pedida = etapaDaUrl();
    const voz = new URLSearchParams(window.location.search).get("voz") === "1";
    const etapa = etapaValida(pedida, salvo) ? pedida : etapaValida(salvo.etapa, salvo) ? salvo.etapa : "captura";
    setR({ ...salvo, etapa });
    window.history.replaceState(null, "", urlDa(etapa));
    iniciou({ pronto: true, vozAuto: voz });
    carregarBase().then(setBase);
  }, []);

  useEffect(() => { if (pronto) salvarRascunho(r); }, [r, pronto]);

  // Botão voltar/avançar do navegador.
  useEffect(() => {
    const aoVoltar = () => {
      const atual = rRef.current;
      const alvo = etapaDaUrl();
      if (atual.ocorrencia && alvo !== "protocolo") { novoReporte(); return; } // já enviado: não volta para confirmar de novo
      setR({ ...atual, etapa: etapaValida(alvo, atual) ? alvo : "captura" });
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A cada etapa nova, o foco vai para o topo do painel (leitor de tela anuncia a mudança).
  useEffect(() => { if (pronto) { titulo.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); } }, [r.etapa, pronto]);

  const irPara = useCallback((etapa: Etapa, mudancas: Partial<Rascunho> = {}, historico: "push" | "replace" = "push") => {
    setR((x) => ({ ...x, ...mudancas, etapa }));
    if (historico === "push") window.history.pushState(null, "", urlDa(etapa));
    else window.history.replaceState(null, "", urlDa(etapa));
  }, []);

  const trocarFoto = async (f: File) => {
    setErroFoto(null);
    setPreparandoFoto(true);
    try {
      const pronta = await prepararFoto(f);
      setFoto((ant) => { if (ant) URL.revokeObjectURL(ant.url); return { arquivo: pronta, url: URL.createObjectURL(pronta) }; });
    } catch (e) {
      setErroFoto(e instanceof ErroFoto ? e.message : "Não consegui usar essa foto. Tente outra.");
    } finally { setPreparandoFoto(false); }
  };
  const removerFoto = () => { setFoto((ant) => { if (ant) URL.revokeObjectURL(ant.url); return null; }); setErroFoto(null); };

  const analisar = async () => {
    const atual = rRef.current;
    setR((x) => ({ ...x, etapa: "analisando", analise: null, manual: null, deteccoes: [], avisoFoto: null, categoriaId: null, escolha: "ia" }));
    setPasso(0);
    let deteccoes: Deteccao[] = [];
    let avisoFoto: string | null = null;
    if (foto) {
      try { deteccoes = (await api.detectarFoto(foto.arquivo)).deteccoes; }
      catch { avisoFoto = "Usei só a sua descrição."; }
      setPasso(1);
    }
    try {
      const analise = await api.analisar({ descricao: atual.descricao.trim(), localizacao: atual.local, deteccoes_visao: deteccoes });
      setPasso(foto ? 2 : 1);
      await new Promise((ok) => setTimeout(ok, 350)); // deixa ver a última etapa marcada
      if (!analise.guardrail.pode_continuar) {
        removerFoto();
        irPara("emergencia", { analise, deteccoes: [], avisoFoto: null });
        return;
      }
      irPara("resultado", { analise, deteccoes, avisoFoto, categoriaId: analise.categoria?.id ?? null, escolha: "ia" });
    } catch {
      // API fora do ar / timeout: escolha manual com a lista embutida, e o 156.
      irPara("resultado", { analise: null, manual: "falha", deteccoes, avisoFoto, categoriaId: null, escolha: "cidadao" });
    }
  };

  const naoEEmergencia = () => {
    const g = r.analise?.guardrail;
    if (g) api.naoEEmergencia(g.nivel, g.tipo).catch(() => { /* registro anônimo: se falhar, segue */ });
    irPara("resultado", { manual: "nao_emergencia", categoriaId: null, escolha: "cidadao" }, "replace");
  };

  const escolher = (c: Categoria) => setR((x) => ({ ...x, categoriaId: c.id, escolha: x.analise?.categoria?.id === c.id && x.escolha === "ia" ? "ia" : "cidadao" }));

  const confirmar = async () => {
    if (enviando || !r.categoriaId) return;
    setEnviando(true);
    setErroEnvio(null);
    const referencia = r.referencia.trim();
    try {
      const o = await api.criarOcorrencia({
        descricao: referencia ? `${r.descricao.trim()} (Local: ${referencia})`.slice(0, 1000) : r.descricao.trim(),
        localizacao: r.local ?? CENTRO_SP,
        categoria_sugerida: r.analise?.categoria?.id ?? null,
        confianca: r.analise?.confianca ?? 0,
        categoria_final: r.categoriaId,
        foto_url: null,
      });
      despachar({ tipo: "reporteEnviado", ocorrencia: o });
      removerFoto();
      irPara("protocolo", { ocorrencia: o }, "replace");
    } catch (e) {
      setErroEnvio(e instanceof ErroAPI ? e.mensagem : "Algo deu errado.");
    } finally { setEnviando(false); }
  };

  function novoReporte() {
    apagarRascunho();
    removerFoto();
    setErroEnvio(null);
    setR(RASCUNHO_VAZIO);
    window.history.replaceState(null, "", "/reportar");
  }

  const categoria = base.categorias.find((c) => c.id === r.categoriaId) ?? null;
  const responsavel = categoria ? base.responsaveis.find((x) => x.id === categoria.responsavel_id) ?? null : null;
  const etapasAnalise = [...(foto ? ["Olhando a foto"] : []), "Entendendo o que você escreveu", "Descobrindo quem resolve"];

  return (
    <Painel className="grid gap-4">
      <p ref={titulo} tabIndex={-1} className="sr-only">Reportar problema, etapa: {NOMES_ETAPA[r.etapa]}</p>
      {!pronto ? <Carregando texto="Abrindo…" /> : <>
        {r.etapa === "captura" && (
          <Captura descricao={r.descricao} referencia={r.referencia} local={r.local}
            previa={foto?.url ?? null} preparandoFoto={preparandoFoto} erroFoto={erroFoto} vozAuto={vozAuto}
            aoMudar={(p) => setR((x) => ({ ...x, ...p }))} aoFoto={trocarFoto} aoRemoverFoto={removerFoto} aoContinuar={analisar} />
        )}
        {r.etapa === "analisando" && (
          <div className="grid gap-2">
            <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Só um instante</h1>
            <Carregando texto={etapasAnalise[Math.min(passo, etapasAnalise.length - 1)] + "…"} etapas={etapasAnalise} atual={passo} />
          </div>
        )}
        {r.etapa === "emergencia" && r.analise && <Emergencia guardrail={r.analise.guardrail} aoContinuar={naoEEmergencia} />}
        {r.etapa === "resultado" && (
          <Resultado r={r} base={base} previa={foto?.url ?? null} aoEscolher={escolher}
            aoContinuar={() => irPara("confirmacao")} aoDetalhar={() => irPara("captura")} />
        )}
        {r.etapa === "confirmacao" && categoria && (
          <Confirmacao r={r} categoria={categoria} responsavel={responsavel} temFoto={!!foto}
            enviando={enviando} erro={erroEnvio} aoConfirmar={confirmar} />
        )}
        {r.etapa === "protocolo" && r.ocorrencia && (
          <Protocolo ocorrencia={r.ocorrencia} categoria={categoria} responsavel={responsavel} aoNovo={novoReporte} />
        )}
      </>}
    </Painel>
  );
}

const NOMES_ETAPA: Record<Etapa, string> = {
  captura: "o que está acontecendo", analisando: "analisando", emergencia: "emergência", resultado: "resultado",
  confirmacao: "confirmação", protocolo: "protocolo",
};

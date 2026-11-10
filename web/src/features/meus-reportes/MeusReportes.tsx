"use client";
// Meus reportes: o que foi enviado deste aparelho (sem cadastro), com o status atual da API.
import { CircleCheck, Clock, Plus, RefreshCw, Send, TriangleAlert, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { api } from "@/providers/api";
import { BASE_RESERVA, carregarBase, type BaseQuemResolve } from "@/providers/base";
import type { Ocorrencia, Status } from "@/providers/tipos";
import { useAppState } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoLink } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Selo, type Tom } from "@/ui/Selo";
import { CartaoVidro, Painel } from "@/ui/Vidro";

const STATUS: Record<Status, { tom: Tom; icone: LucideIcon; texto: string; explica: string }> = {
  pendente_envio: { tom: "neutro", icone: Clock, texto: "Aguardando envio", explica: "Já registramos. Logo vai para o órgão." },
  enviada: { tom: "info", icone: Send, texto: "Enviada ao órgão", explica: "O órgão recebeu e deve agir." },
  possivelmente_resolvida: { tom: "warn", icone: TriangleAlert, texto: "Talvez resolvida", explica: "Há sinais de que foi resolvido. Ainda confirmando." },
  resolvida: { tom: "ok", icone: CircleCheck, texto: "Resolvida", explica: "O problema foi resolvido." },
};

type Situacao = "carregando" | "ok" | "offline";

export function MeusReportes() {
  const { estado, despachar } = useAppState();
  const [base, setBase] = useState<BaseQuemResolve>(BASE_RESERVA);
  const [situacao, setSituacao] = useReducer((_: Situacao, n: Situacao) => n, "carregando");
  const [sumidos, setSumidos] = useState<Set<string>>(new Set());
  const reportes = estado.meusReportes;

  const ids = reportes.slice(0, 20).map((r) => r.id).join(",");

  // Consulta o status de cada reporte (GET /ocorrencias/{id}) e aplica no estado central.
  const aplicar = useCallback((resultados: PromiseSettledResult<Ocorrencia>[], lista: string[]) => {
    const tipo = (x: PromiseSettledResult<Ocorrencia>) => (x.status === "rejected" ? (x.reason as { tipo?: string })?.tipo : null);
    const atualizados = resultados.flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
    setSumidos(new Set(lista.filter((_, i) => tipo(resultados[i]) === "nao_encontrado")));
    if (atualizados.length) despachar({ tipo: "statusAtualizado", atualizados });
    setSituacao(resultados.some((x) => x.status === "rejected" && tipo(x) !== "nao_encontrado") ? "offline" : "ok");
  }, [despachar]);

  useEffect(() => {
    if (!estado.carregado || !ids) return;
    let vivo = true;
    const lista = ids.split(",");
    Promise.allSettled(lista.map((id) => api.ocorrencia(id))).then((res) => { if (vivo) aplicar(res, lista); });
    return () => { vivo = false; };
  }, [estado.carregado, ids, aplicar]);

  const atualizar = () => {
    const lista = ids.split(",");
    setSituacao("carregando");
    Promise.allSettled(lista.map((id) => api.ocorrencia(id))).then((res) => aplicar(res, lista));
  };

  useEffect(() => { carregarBase().then(setBase); }, []);

  const nomeCategoria = (id: string) => base.categorias.find((c) => c.id === id)?.nome ?? id;
  const nomeResp = (id: string) => base.responsaveis.find((r) => r.id === id)?.nome ?? id;
  const data = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <Painel className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Meus reportes</h1>
        {reportes.length > 0 && situacao !== "carregando" && (
          <Botao variante="link" icone={RefreshCw} onClick={atualizar}>Atualizar</Botao>
        )}
      </div>
      {!estado.carregado ? <Carregando texto="Abrindo…" /> : !reportes.length ? (
        <div className="grid gap-4">
          <Vazio titulo="Você ainda não reportou nada" texto="Os problemas que você reportar neste aparelho aparecem aqui, com o andamento." />
          <BotaoLink href="/reportar" icone={Plus} bloco>Reportar um problema</BotaoLink>
        </div>
      ) : <>
        {situacao === "carregando" && <Carregando texto="Buscando o andamento…" />}
        {situacao === "offline" && (
          <Aviso tipo="warn" titulo="Não consegui atualizar agora">Mostrando o último status conhecido. Tente de novo em instantes.</Aviso>
        )}
        <p className="text-base text-ink-muted">Fica salvo só neste aparelho. Não precisa de cadastro.</p>
        <ul className="grid gap-3">
          {reportes.map((r, i) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id}>
                <CartaoVidro indice={i}>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-xl leading-[26px] font-semibold">{nomeCategoria(r.categoria_final)}</h2>
                      <Selo tom={s.tom} icone={s.icone} texto={s.texto} />
                    </div>
                    <p className="text-ink-muted">{s.explica}</p>
                    <p>Quem resolve: <strong>{nomeResp(r.responsavel_id)}</strong></p>
                    <p className="flex flex-wrap gap-x-4 text-base text-ink-muted">
                      <span>Protocolo <span className="font-mono text-ink">{r.protocolo}</span></span>
                      <span>Enviado em {data(r.criada_em)}</span>
                    </p>
                    {sumidos.has(r.id) && <p className="text-base text-ink-muted">O servidor de demonstração foi reiniciado e não tem mais este reporte. O status acima é o último conhecido.</p>}
                  </div>
                </CartaoVidro>
              </li>
            );
          })}
        </ul>
        <BotaoLink href="/reportar" variante="secundario" icone={Plus} bloco>Reportar outro problema</BotaoLink>
      </>}
    </Painel>
  );
}

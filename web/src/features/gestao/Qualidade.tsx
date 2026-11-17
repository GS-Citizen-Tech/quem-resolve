"use client";
// Qualidade da IA: números em linguagem simples em cima, fila para revisar, leitura das fotos, desvios para emergência
// (só contagens, nunca o texto de ninguém). O que é real ou demonstração fica em "Detalhes técnicos", recolhido.
import { api } from "@/providers/api";
import type { Metricas, Ocorrencia, Qualidade as TQualidade } from "@/providers/tipos";
import { Carregando, Vazio } from "@/ui/Estados";
import { BarraPartes } from "@/ui/BarraPartes";
import { Indicador } from "@/ui/Indicador";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { TabelaFila } from "./Filas";
import { pct, useConsulta } from "./hooks";

const LIMIAR = 0.5; // abaixo disso o app pede confirmação (design system)

const NOME_MODULO: Record<string, string> = {
  llm: "Leitura do texto", visao: "Leitura da foto", visao_reserva: "Segunda leitura da foto", rag: "Tirar dúvida", voz: "Voz",
  geo: "Endereço", banco: "Banco de dados",
};
const NOME_ORIGEM_VISAO: Record<string, string> = { yolo: "Modelo treinado", multimodal: "Segunda leitura", nenhuma: "Nada encontrado" };
const NIVEL: Record<number, string> = { 1: "Emergência", 2: "Urgente", 3: "Atenção" };

function estadoModulo(valor: string) {
  const v = valor.toLowerCase();
  if (v === "mock" || v === "memoria") return "Em demonstração";
  if (!v || ["off", "nenhum", "nenhuma", "desligado", "desligada", "none"].includes(v)) return "Desligado";
  return "Ligado";
}

interface Dados { q: TQualidade; baixa: Ocorrencia[]; m: Metricas }

export function Qualidade() {
  const { dados, erro, carregando, atualizar } = useConsulta<Dados>(async () => {
    const [q, oc, m] = await Promise.all([api.qualidade(), api.ocorrencias(), api.metricas({})]);
    return { q, m, baixa: oc.filter((o) => o.confianca > 0 && o.confianca < LIMIAR && !o.corrigida_pelo_gestor) };
  }, "qualidade");

  return (
    <>
      <CabecalhoTela titulo="Qualidade da IA"
        atualizar={atualizar} carregando={carregando} />
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os números…" /></div>) : <Conteudo {...dados} />}
    </>
  );
}

function Conteudo({ q, baixa, m }: Dados) {
  const fb = (k: string) => q.feedback[k] ?? { util: 0, total: 0 };
  const util = (k: string) => (fb(k).total ? pct((fb(k).util / fb(k).total) * 100) : "—");
  const notaUtil = (k: string) => (fb(k).total ? `${fb(k).util} de ${fb(k).total} respostas` : "Ninguém respondeu ainda");
  const ms = (v: number | null) => (v == null ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
  const origens = Object.entries(q.visao.por_origem).map(([k, v]) => ({ chave: k, rotulo: NOME_ORIGEM_VISAO[k] ?? k, valor: v }));
  const corrigidas = q.classificacao.corrigidas_pelo_cidadao + q.classificacao.corrigidas_pelo_gestor;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Indicador rotulo="Certeza média da IA" valor={q.classificacao.confianca_media != null ? pct(q.classificacao.confianca_media * 100) : "—"}
          nota={`Em ${q.classificacao.total} ocorrências`} />
        <Indicador rotulo="Corrigidas por pessoas" valor={String(corrigidas)}
          nota={`${q.classificacao.corrigidas_pelo_cidadao} pelo cidadão (${pct(m.taxa_correcao_cidadao, 1)}), ${q.classificacao.corrigidas_pelo_gestor} pelo gestor`} />
        <Indicador rotulo="Foram para outros órgãos" valor={pct(m.pct_fora_prefeitura, 1)} nota="Enel, Sabesp, Comgás e CET" />
        <Indicador rotulo="Reporte ajudou" valor={util("reporte")} nota={notaUtil("reporte")} />
        <Indicador rotulo="Tirar dúvida ajudou" valor={util("assistente")} nota={notaUtil("assistente")} />
      </div>

      <section aria-labelledby="baixa-t" className="grid gap-2">
        <div className="px-1">
          <h2 id="baixa-t" className="text-[15px] font-semibold">Para revisar ({baixa.length})</h2>
          <p className="text-[13px] text-ink-muted">A IA teve menos de 50% de certeza nestas.</p>
        </div>
        {baixa.length ? <TabelaFila ocorrencias={baixa} titulo="Para revisar" />
          : <div className="glass rounded-panel px-4"><Vazio titulo="Nada para revisar" /></div>}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-panel p-4 md:p-5">
          {q.visao.chamadas ? (
            <>
              <BarraPartes titulo="Leitura das fotos" partes={origens} unidade="fotos" />
              <p className="mt-2 px-2 text-[13px] text-ink-muted">{q.visao.chamadas} fotos, resposta em {ms(q.visao.latencia_media_ms)} em média.</p>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold">Leitura das fotos</h2>
              <Vazio titulo="Nenhuma foto analisada ainda" />
            </>
          )}
        </section>
        <section className="glass rounded-panel p-4 md:p-5" aria-labelledby="guard-t">
          <h2 id="guard-t" className="mb-2 text-[15px] font-semibold">Desvios para emergência</h2>
          {q.guardrail.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Vezes em que o app mandou ligar para um número de emergência, por nível</caption>
              <thead><tr className="border-b border-line-strong text-left text-xs text-ink-muted">
                <th scope="col" className="py-1.5 font-semibold">Nível</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Desvios</th>
                <th scope="col" className="py-1.5 text-right font-semibold">“Não é emergência”</th>
              </tr></thead>
              <tbody>
                {q.guardrail.map((g) => (
                  <tr key={g.nivel} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">{NIVEL[g.nivel] ?? `Nível ${g.nivel}`}</th>
                    <td className="py-2 text-right tabular-nums">{g.total}</td>
                    <td className="py-2 text-right tabular-nums">{g.nao_e_emergencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-ink-muted">Nenhum desvio até agora.</p>}
        </section>
      </div>

      <details className="glass rounded-panel px-4 py-3 md:px-5">
        <summary className="flex min-h-console cursor-pointer items-center text-[15px] font-semibold">Detalhes técnicos</summary>
        <dl className="grid gap-x-8 pt-1 pb-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(q.modulos).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
              <dt>{NOME_MODULO[k] ?? k}</dt>
              <dd className="text-right"><span className="font-semibold">{estadoModulo(v)}</span> <span className="font-mono text-xs text-ink-muted">{v}</span></dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
            <dt>Tempo de resposta da foto</dt>
            <dd className="text-right tabular-nums">{ms(q.visao.latencia_media_ms)} <span className="text-xs text-ink-muted">(pior caso {ms(q.visao.latencia_p95_ms)})</span></dd>
          </div>
        </dl>
        <p className="pb-1 text-xs text-ink-muted">Os números de fotos, respostas e desvios contam desde a última vez que o servidor ligou. Nenhum texto de cidadão aparece aqui.</p>
      </details>
    </>
  );
}

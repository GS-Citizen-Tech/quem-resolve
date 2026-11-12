"use client";
// Qualidade da IA: o que é real e o que é simulado, números da visão, confiança, fila de baixa confiança (para revisar),
// "Isso ajudou?" e acionamentos do guardrail (só números por nível, nunca o texto de ninguém).
import { CircleCheck, FlaskConical, Gauge, PowerOff, ScanSearch, Sparkles, ThumbsUp } from "lucide-react";
import { api } from "@/providers/api";
import type { Ocorrencia, Qualidade as TQualidade } from "@/providers/tipos";
import { Carregando, Vazio } from "@/ui/Estados";
import { GraficoPlotly } from "@/ui/GraficoPlotly";
import { Indicador } from "@/ui/Indicador";
import { Selo } from "@/ui/Selo";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { TabelaFila } from "./Filas";
import { pct, useConsulta } from "./hooks";

const LIMIAR = 0.5; // abaixo disso o app pede confirmação (design system)

const NOME_MODULO: Record<string, string> = {
  llm: "Classificação (LLM)", visao: "Visão (foto)", visao_reserva: "Visão reserva (multimodal)", rag: "Assistente (RAG)", voz: "Voz",
};
const NOME_ORIGEM_VISAO: Record<string, string> = { yolo: "YOLO (treinado)", multimodal: "Reserva multimodal", nenhuma: "Nada detectado" };
const NIVEL: Record<number, string> = { 1: "Nível 1 · emergência", 2: "Nível 2 · urgente", 3: "Nível 3 · atenção" };

function SeloModulo({ valor }: { valor: string }) {
  const v = valor.toLowerCase();
  if (v === "mock") return <Selo tom="warn" icone={FlaskConical} compacto texto="Simulado (mock)" />;
  if (!v || ["off", "nenhum", "nenhuma", "desligado", "desligada", "none"].includes(v)) return <Selo tom="neutro" icone={PowerOff} compacto texto="Desligado" />;
  return <Selo tom="ok" icone={CircleCheck} compacto texto={`Real · ${valor}`} />;
}

interface Dados { q: TQualidade; baixa: Ocorrencia[] }

export function Qualidade() {
  const { dados, erro, carregando, atualizar } = useConsulta<Dados>(async () => {
    const [q, oc] = await Promise.all([api.qualidade(), api.ocorrencias()]);
    return { q, baixa: oc.filter((o) => o.confianca > 0 && o.confianca < LIMIAR && !o.corrigida_pelo_gestor) };
  }, "qualidade");

  return (
    <>
      <CabecalhoTela titulo="Qualidade da IA" descricao="Os números de visão, “Isso ajudou?” e guardrail contam desde que a API ligou. Nenhum texto de cidadão aparece aqui."
        atualizar={atualizar} carregando={carregando} />
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando os números…" /></div>) : <Conteudo {...dados} />}
    </>
  );
}

function Conteudo({ q, baixa }: Dados) {
  const fb = (k: string) => q.feedback[k] ?? { util: 0, total: 0 };
  const util = (k: string) => (fb(k).total ? pct((fb(k).util / fb(k).total) * 100) : "—");
  const ms = (v: number | null) => (v == null ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
  const origens = Object.entries(q.visao.por_origem).map(([k, v]) => ({ chave: k, rotulo: NOME_ORIGEM_VISAO[k] ?? k, valor: v }));

  return (
    <>
      <section className="glass rounded-panel p-4 md:p-5" aria-labelledby="mod-t">
        <h2 id="mod-t" className="mb-2 text-base font-semibold">Módulos</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(q.modulos).map(([k, v]) => (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-chip bg-surface-raised px-3 py-2 text-sm">
              <span className="font-semibold">{NOME_MODULO[k] ?? k}</span><SeloModulo valor={v} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={ScanSearch} rotulo="Fotos analisadas" valor={String(q.visao.chamadas)} nota={`Latência média ${ms(q.visao.latencia_media_ms)} · p95 ${ms(q.visao.latencia_p95_ms)}`} />
        <Indicador icone={Gauge} rotulo="Confiança média" valor={q.classificacao.confianca_media != null ? pct(q.classificacao.confianca_media * 100) : "—"}
          nota={`${q.classificacao.total} ocorrências · ${q.classificacao.corrigidas_pelo_cidadao} corrigidas pelo cidadão · ${q.classificacao.corrigidas_pelo_gestor} pelo gestor`} />
        <Indicador icone={ThumbsUp} rotulo="“Isso ajudou?” no reporte" valor={util("reporte")} nota={`${fb("reporte").util} de ${fb("reporte").total} disseram que sim`} />
        <Indicador icone={Sparkles} rotulo="“Isso ajudou?” no assistente" valor={util("assistente")} nota={`${fb("assistente").util} de ${fb("assistente").total} disseram que sim`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-panel p-4 md:p-5">
          {q.visao.chamadas ? (
            <GraficoPlotly titulo="Quem respondeu nas fotos" horizontal={false} unidade="fotos" dados={origens}
              descricao="O YOLO treinado olha primeiro. A reserva multimodal só entra quando ele não acha nada." />
          ) : <Vazio titulo="Nenhuma foto analisada ainda" texto="Faça um reporte com foto no app do cidadão para ver os números da visão." />}
        </section>
        <section className="glass rounded-panel p-4 md:p-5" aria-labelledby="guard-t">
          <h2 id="guard-t" className="text-base font-semibold">Guardrail de segurança</h2>
          <p className="mb-2 text-xs text-ink-muted">Quantas vezes desviou para 190, 192, 193, 180… Só contagens, sem texto.</p>
          {q.guardrail.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Acionamentos do guardrail por nível</caption>
              <thead><tr className="border-b border-line-strong text-left text-xs text-ink-muted">
                <th scope="col" className="py-1.5 font-semibold">Nível</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Acionamentos</th>
                <th scope="col" className="py-1.5 text-right font-semibold">“Não é emergência”</th>
              </tr></thead>
              <tbody>
                {q.guardrail.map((g) => (
                  <tr key={g.nivel} className="border-b border-border">
                    <th scope="row" className="py-1.5 text-left font-normal">{NIVEL[g.nivel] ?? `Nível ${g.nivel}`}</th>
                    <td className="py-1.5 text-right tabular-nums">{g.total}</td>
                    <td className="py-1.5 text-right tabular-nums">{g.nao_e_emergencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-ink-muted">Nenhum acionamento desde que a API ligou.</p>}
        </section>
      </div>

      <section aria-labelledby="baixa-t" className="grid gap-2">
        <h2 id="baixa-t" className="px-1 text-base font-semibold">Baixa confiança esperando revisão ({baixa.length})</h2>
        <p className="px-1 text-xs text-ink-muted">A IA teve menos de 50% de certeza. Abra, confira e reclassifique se precisar: ela sai daqui quando o gestor corrige.</p>
        {baixa.length ? <TabelaFila ocorrencias={baixa} titulo="Baixa confiança" />
          : <Vazio titulo="Nada para revisar" texto="Todas as classificações de baixa confiança já foram revisadas." />}
      </section>
    </>
  );
}

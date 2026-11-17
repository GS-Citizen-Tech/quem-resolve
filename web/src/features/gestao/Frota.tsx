"use client";
// Frota: envio de vídeo ou fotos para processar (v1.0), trajeto de cada passagem de ônibus, o que a câmera detectou,
// FPS do processamento e os recortes já borrados.
// Quando o ônibus passa perto de um problema aberto e não o vê mais, ele vira "possivelmente resolvida" (regra da API, 25 m).
import { Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/providers/api";
import type { Ocorrencia, PassagemResumo } from "@/providers/tipos";
import { Carregando, Vazio } from "@/ui/Estados";
import { Indicador } from "@/ui/Indicador";
import { LegendaMapa, MapaOcorrencias, tomDaOcorrencia, type PontoMapa, type TrajetoMapa } from "@/ui/MapaOcorrencias";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { EnvioFrota } from "./EnvioFrota";
import { agrupar } from "./Filas";
import { BarraPartes } from "@/ui/BarraPartes";
import { dataCurta, NOME_ORIGEM, useBase, useConsulta } from "./hooks";

interface DadosFrota { passagens: [string, PassagemResumo][]; ocorrencias: Ocorrencia[]; origens: Record<string, number> }

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const num = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

export function Frota() {
  const { dados, erro, carregando, atualizar } = useConsulta<DadosFrota>(async () => {
    const [p, o] = await Promise.all([api.passagens(), api.ocorrencias()]);
    return {
      passagens: Object.entries(p).sort(([, a], [, b]) => b.inicio.localeCompare(a.inicio)),
      ocorrencias: o.filter((x) => x.origem !== "cidadao" || x.status === "possivelmente_resolvida"),
      origens: o.reduce<Record<string, number>>((m, x) => ({ ...m, [x.origem]: (m[x.origem] ?? 0) + 1 }), {}),
    };
  }, "frota");
  const { nomeCategoria } = useBase();
  const [passagem, setPassagem] = useState<string | null>(null);
  const [envio, setEnvio] = useState(false);

  const daFrota = useMemo(() => (dados?.ocorrencias ?? []).filter((o) => o.origem !== "cidadao"), [dados]);
  const trajetos = useMemo<TrajetoMapa[]>(() => (dados?.passagens ?? [])
    .filter(([id]) => !passagem || id === passagem)
    .map(([id, p]) => ({ id, rotulo: p.linha_onibus, pontos: p.trajeto })), [dados, passagem]);
  const pontos = useMemo<PontoMapa[]>(() => agrupar(daFrota).map(({ principal: o }) => ({
    id: o.id, lat: o.lat, lon: o.lon, origem: o.origem, tom: tomDaOcorrencia(o), titulo: `${nomeCategoria(o.categoria_final)} · ${o.protocolo}`,
  })), [daFrota, nomeCategoria]);
  const resolvidas = (dados?.ocorrencias ?? []).filter((o) => o.status === "possivelmente_resolvida");
  const recortes = daFrota.filter((o) => o.foto_url).slice(0, 12);

  const ps = dados?.passagens ?? [];
  const fpsLista = ps.map(([, p]) => p.fps).filter((f): f is number => f != null);
  const fpsMedio = fpsLista.length ? fpsLista.reduce((a, b) => a + b, 0) / fpsLista.length : null;
  const vistosTambem = daFrota.filter((o) => o.origem === "ambos").length;

  return (
    <>
      <CabecalhoTela titulo="Frota" descricao="O que as câmeras dos ônibus encontraram na rua." atualizar={atualizar} carregando={carregando}
        acoes={<button type="button" aria-expanded={envio} onClick={() => setEnvio((e) => !e)}
          className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-brand-hover">
          <Upload aria-hidden="true" className="size-4" />Analisar vídeo
        </button>} />
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      <EnvioFrota aberto={envio} fechar={() => setEnvio(false)} aoConcluir={(id) => { setPassagem(id); setEnvio(true); atualizar(); }} />
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando as passagens…" /></div>) : ps.length === 0 ? (
        <div className="glass rounded-panel px-5"><Vazio titulo="Nenhum ônibus passou ainda" texto="Use “Analisar vídeo” para enviar a gravação de uma câmera." /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Indicador rotulo="Passagens" valor={String(ps.length)} nota={`Em ${new Set(ps.map(([, p]) => p.linha_onibus)).size} linhas de ônibus`} />
            <Indicador rotulo="Danos encontrados" valor={String(daFrota.length)}
              nota={vistosTambem ? `Buracos e rachaduras, ${vistosTambem} também ${vistosTambem === 1 ? "reportado" : "reportados"} por cidadãos` : "Buracos e rachaduras no asfalto"} />
            <Indicador rotulo="Velocidade da análise" valor={fpsMedio != null ? num(fpsMedio) : "—"} nota="Quadros por segundo" />
            <Indicador rotulo="Possivelmente resolvidas" valor={String(resolvidas.length)} nota="O ônibus passou de novo e não viu" />
          </div>
          <section className="glass grid gap-3 rounded-panel p-3 md:p-4" aria-label="Trajetos no mapa">
            <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
              <MapaOcorrencias rotulo="Trajetos dos ônibus e detecções" trajetos={trajetos} pontos={pontos}
                foco={passagem ? trajetos.find((t) => t.id === passagem)?.pontos : undefined} />
              <section aria-labelledby="passagens-t" className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="passagens-t" className="text-[15px] font-semibold">Passagens</h2>
                  {passagem && <button type="button" onClick={() => setPassagem(null)} className="min-h-console cursor-pointer text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink">Mostrar todas</button>}
                </div>
                <ul className="grid max-h-[372px] overflow-y-auto overscroll-contain pr-1" aria-label="Passagens, da mais recente">
                  {ps.map(([id, p]) => (
                    <li key={id} className="border-t border-[var(--qr-linha,var(--border))] first:border-t-0">
                      <button type="button" aria-pressed={passagem === id} onClick={() => setPassagem(passagem === id ? null : id)}
                        className="grid w-full cursor-pointer gap-0.5 rounded-chip px-2 py-2.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--qr-ink)_4%,transparent)] aria-pressed:bg-destaque-soft">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">Linha {p.linha_onibus}</span>
                          <span className="text-xs text-ink-muted tabular-nums">{dataCurta(p.inicio)} às {hora.format(new Date(p.fim))}</span>
                        </span>
                        <span className="text-[13px] text-ink-muted">
                          {p.deteccoes} {p.deteccoes === 1 ? "dano" : "danos"}
                          {!!p.possivelmente_resolvidas && `, ${p.possivelmente_resolvidas} possivelmente resolvido${p.possivelmente_resolvidas > 1 ? "s" : ""}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <LegendaMapa comTrajeto />
          </section>
          <section className="glass rounded-panel p-4 md:p-5">
            <BarraPartes titulo="Quem viu o problema (todos os reportes)"
              partes={["cidadao", "ambos", "frota"].map((k) => ({ chave: k, rotulo: NOME_ORIGEM[k as keyof typeof NOME_ORIGEM], valor: dados.origens[k] ?? 0 }))} />
          </section>
          {resolvidas.length > 0 && (
            <section className="glass rounded-panel p-3 md:p-4" aria-labelledby="resolvidas-t">
              <h2 id="resolvidas-t" className="text-[15px] font-semibold">Possivelmente resolvidas</h2>
              <p className="mb-2 text-[13px] text-ink-muted">Confirme no local antes de marcar como resolvida.</p>
              <ul className="grid gap-1">
                {resolvidas.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                    <span className="font-mono text-xs text-ink-muted">{o.protocolo}</span>
                    <Link href={`/gestao/filas?responsavel=${o.responsavel_id}&abrir=${o.id}`} className="min-h-console content-center text-sm font-semibold underline underline-offset-4">Abrir na fila</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recortes.length > 0 && (
          <section className="glass rounded-panel p-3 md:p-4" aria-labelledby="recortes-t">
            <h2 id="recortes-t" className="text-[15px] font-semibold">Fotos dos danos</h2>
            <p className="mb-3 text-[13px] text-ink-muted">Rostos e placas já chegam borrados.</p>
            {(
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {recortes.map((o) => (
                  <li key={o.id} className="grid gap-1 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.foto_url!} alt={`Recorte borrado: ${nomeCategoria(o.categoria_final)}`} className="aspect-video w-full rounded-chip object-cover" />
                    <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                    <span className="text-ink-muted">{dataCurta(o.criada_em)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </>
      )}
    </>
  );
}

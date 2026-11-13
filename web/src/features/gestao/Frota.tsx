"use client";
// Frota: envio de vídeo ou fotos para processar (v1.0), trajeto de cada passagem de ônibus, o que a câmera detectou,
// FPS do processamento e os recortes já borrados.
// Quando o ônibus passa perto de um problema aberto e não o vê mais, ele vira "possivelmente resolvida" (regra da API, 25 m).
import { Bus, Gauge, ScanSearch, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/providers/api";
import type { Ocorrencia, PassagemResumo } from "@/providers/tipos";
import { Carregando, Vazio } from "@/ui/Estados";
import { Indicador } from "@/ui/Indicador";
import { LegendaMapa, MapaOcorrencias, tomDaOcorrencia, type PontoMapa, type TrajetoMapa } from "@/ui/MapaOcorrencias";
import { SeloOrigem, SeloStatus } from "@/ui/Selo";
import { CabecalhoTela, ErroConsulta } from "./Comum";
import { EnvioFrota } from "./EnvioFrota";
import { agrupar } from "./Filas";
import { coord, dataCurta, useBase, useConsulta } from "./hooks";

interface DadosFrota { passagens: [string, PassagemResumo][]; ocorrencias: Ocorrencia[] }

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const num = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

export function Frota() {
  const { dados, erro, carregando, atualizar } = useConsulta<DadosFrota>(async () => {
    const [p, o] = await Promise.all([api.passagens(), api.ocorrencias()]);
    return {
      passagens: Object.entries(p).sort(([, a], [, b]) => b.inicio.localeCompare(a.inicio)),
      ocorrencias: o.filter((x) => x.origem !== "cidadao" || x.status === "possivelmente_resolvida"),
    };
  }, "frota");
  const { nomeCategoria } = useBase();
  const [passagem, setPassagem] = useState<string | null>(null);

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
  const deteccoes = ps.reduce((a, [, p]) => a + p.deteccoes, 0);

  return (
    <>
      <CabecalhoTela titulo="Frota" descricao="Envie o vídeo de uma câmera de ônibus para processar aqui, ou veja o que os ônibus já detectaram. Só ficam as detecções, os recortes e o vídeo anotado, todos borrados."
        atualizar={atualizar} carregando={carregando} />
      {erro && <ErroConsulta erro={erro} tentar={atualizar} temDados={!!dados} />}
      <EnvioFrota aoConcluir={(id) => { setPassagem(id); atualizar(); }} />
      {!dados ? (!erro && <div className="glass rounded-panel p-6"><Carregando texto="Carregando as passagens…" /></div>) : ps.length === 0 ? (
        <Vazio titulo="Nenhuma passagem de ônibus ainda" texto="Envie um vídeo ou fotos acima. O script frota/processar_video.py (versão dentro do ônibus) também envia passagens." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador icone={Bus} rotulo="Passagens" valor={String(ps.length)} nota={`${new Set(ps.map(([, p]) => p.linha_onibus)).size} linhas de ônibus`} />
            <Indicador icone={ScanSearch} rotulo="Detecções" valor={String(deteccoes)} nota="Somando todas as passagens" />
            <Indicador icone={Gauge} rotulo="FPS médio" valor={fpsMedio != null ? num(fpsMedio) : "—"} nota="Quadros por segundo no processamento (YOLO em ONNX, CPU)" />
            <Indicador icone={TriangleAlert} rotulo="Possivelmente resolvidas" valor={String(resolvidas.length)} nota="O ônibus passou a até 25 m e não viu mais" />
          </div>
          <section className="glass grid gap-3 rounded-panel p-3 md:p-4" aria-label="Trajetos no mapa">
            <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
              <MapaOcorrencias rotulo="Trajetos dos ônibus e detecções" trajetos={trajetos} pontos={pontos} />
              <section aria-labelledby="passagens-t" className="grid content-start gap-2">
                <h2 id="passagens-t" className="text-base font-semibold">Passagens</h2>
                <ul className="grid gap-1.5">
                  <li>
                    <button type="button" aria-pressed={!passagem} onClick={() => setPassagem(null)}
                      className="min-h-console w-full cursor-pointer rounded-chip px-3 text-left text-sm font-semibold hover:bg-rail-active/45 aria-pressed:bg-rail-active aria-pressed:text-on-rail-active">
                      Todas no mapa
                    </button>
                  </li>
                  {ps.map(([id, p]) => (
                    <li key={id}>
                      <button type="button" aria-pressed={passagem === id} onClick={() => setPassagem(passagem === id ? null : id)}
                        className="glass-card grid w-full cursor-pointer gap-0.5 rounded-card px-3 py-2 text-left text-sm aria-pressed:shadow-[inset_0_0_0_2px_var(--qr-destaque)]">
                        <span className="font-semibold">Linha {p.linha_onibus}</span>
                        <span className="text-xs text-ink-muted">{dataCurta(p.inicio)} até {hora.format(new Date(p.fim))}</span>
                        <span className="text-xs">
                          {p.deteccoes} {p.deteccoes === 1 ? "detecção" : "detecções"} · {p.fps != null ? `${num(p.fps)} FPS` : "FPS não informado"}
                          {!!p.possivelmente_resolvidas && ` · ${p.possivelmente_resolvidas} possivelmente resolvida${p.possivelmente_resolvidas > 1 ? "s" : ""}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <LegendaMapa comTrajeto />
          </section>
          {resolvidas.length > 0 && (
            <section className="glass rounded-panel p-3 md:p-4" aria-labelledby="resolvidas-t">
              <h2 id="resolvidas-t" className="text-base font-semibold">Possivelmente resolvidas</h2>
              <p className="mb-2 text-xs text-ink-muted">Confirme no local antes de marcar como resolvida.</p>
              <ul className="grid gap-1">
                {resolvidas.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                    <span className="text-xs tabular-nums text-ink-muted">{o.protocolo} · {coord(o.lat, o.lon)}</span>
                    <SeloStatus status={o.status} /><SeloOrigem origem={o.origem} />
                    <Link href={`/gestao/filas?responsavel=${o.responsavel_id}&abrir=${o.id}`} className="min-h-console content-center text-sm font-semibold underline underline-offset-4">Abrir na fila</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="glass rounded-panel p-3 md:p-4" aria-labelledby="recortes-t">
            <h2 id="recortes-t" className="text-base font-semibold">Recortes das detecções</h2>
            <p className="mb-3 text-xs text-ink-muted">Rostos, pessoas e placas são borrados antes de sair do processador. O vídeo bruto nunca chega aqui.</p>
            {recortes.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {recortes.map((o) => (
                  <li key={o.id} className="glass-card grid gap-1 rounded-card p-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.foto_url!} alt={`Recorte borrado: ${nomeCategoria(o.categoria_final)}`} className="aspect-video w-full rounded-chip object-cover" />
                    <span className="font-semibold">{nomeCategoria(o.categoria_final)}</span>
                    <span className="text-ink-muted">{Math.round(o.confianca * 100)}% · {dataCurta(o.criada_em)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">As passagens de exemplo não têm recorte. Eles aparecem quando você processa um vídeo ou fotos acima.</p>}
          </section>
        </>
      )}
    </>
  );
}

"use client";
// Envio pela tela Frota (v1.0): o gestor manda um vídeo curto ou uma sequência de fotos de uma câmera de ônibus.
// A API processa em segundo plano (mesmo núcleo do script do ônibus) e esta seção mostra o progresso,
// o vídeo anotado (já borrado) e os danos, que entram no mapa e nas filas com origem "Ônibus".
import { Film, ImagePlus, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { api, ErroAPI } from "@/providers/api";
import type { Processamento } from "@/providers/tipos";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { useSairPorExpiracao } from "./hooks";

const EXT_VIDEO = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;
const EXT_FOTO = /\.(jpe?g|png|webp)$/i;
const MAX_FOTOS = 60;
const MAX_VIDEO_MB = 80;
const num = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
const rodando = (p: Processamento | null) => p?.status === "na_fila" || p?.status === "processando";

/** Confere o que foi escolhido antes de enviar. Devolve a mensagem do que falta, ou null se está tudo certo. */
function conferir(arquivos: File[]): string | null {
  if (!arquivos.length) return "Escolha um vídeo ou algumas fotos primeiro.";
  const videos = arquivos.filter((a) => EXT_VIDEO.test(a.name));
  const fotos = arquivos.filter((a) => EXT_FOTO.test(a.name));
  if (videos.length + fotos.length !== arquivos.length) return "Use vídeo MP4, MOV ou WebM, ou fotos JPG, PNG ou WebP.";
  if (videos.length && fotos.length) return "Envie um vídeo ou fotos, sem misturar os dois.";
  if (videos.length > 1) return "Envie um vídeo por vez.";
  if (videos.length && videos[0].size > MAX_VIDEO_MB * 1024 * 1024) return `O vídeo passa de ${MAX_VIDEO_MB} MB. Corte um trecho de até 1 minuto.`;
  if (fotos.length > MAX_FOTOS) return `No máximo ${MAX_FOTOS} fotos por envio.`;
  return null;
}

export function EnvioFrota({ aoConcluir }: { aoConcluir: (passagemId: string) => void }) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [linha, setLinha] = useState("8000-10");
  const [gpx, setGpx] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [job, setJob] = useState<Processamento | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const expirou = useSairPorExpiracao();
  const avisado = useRef<string | null>(null);
  const aoConcluirRef = useRef(aoConcluir);
  useEffect(() => { aoConcluirRef.current = aoConcluir; });

  const tratar = (e: unknown) => {
    if (e instanceof ErroAPI && e.tipo === "login") return expirou();
    setErro(e instanceof ErroAPI ? e.mensagem : "Tivemos um problema do nosso lado. Tente de novo em instantes.");
  };

  // Ao abrir a tela: mostra o último processamento (se a página recarregou no meio, retoma o acompanhamento).
  useEffect(() => {
    api.processamentos().then((l) => { if (l[0]) { avisado.current = l[0].status === "concluido" ? l[0].id : null; setJob(l[0]); } }).catch(() => {});
  }, []);

  // Acompanha o progresso enquanto a API processa.
  useEffect(() => {
    if (!job || !rodando(job)) return;
    const t = setTimeout(() => { api.processamento(job.id).then(setJob).catch(tratar); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  // Terminou: busca o vídeo anotado e avisa a tela para recarregar o mapa (uma vez por processamento).
  useEffect(() => {
    if (job?.status !== "concluido") return;
    if (avisado.current !== job.id && job.resultado) { avisado.current = job.id; aoConcluirRef.current(job.resultado.passagem_id); }
    if (!job.video_disponivel) return;
    let url: string | null = null;
    let vivo = true;
    api.videoProcessamento(job.id).then((b) => { if (vivo) { url = URL.createObjectURL(b); setVideo(url); } }).catch(() => {});
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); setVideo(null); };
  }, [job?.id, job?.status, job?.video_disponivel, job?.resultado]);

  const escolher = (lista: FileList | null) => {
    const novos = Array.from(lista ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    setArquivos(novos);
    setErro(novos.length ? conferir(novos) : null);
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    escolher(e.dataTransfer.files);
  };

  const enviar = async () => {
    const problema = conferir(arquivos) ?? (linha.trim() ? null : "Informe a linha do ônibus (ex.: 8000-10).");
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    try {
      setJob(await api.processarFrota(arquivos, linha.trim(), gpx));
      setArquivos([]);
      setGpx(null);
    } catch (e) {
      tratar(e);
    } finally {
      setEnviando(false);
    }
  };

  const tipoEscolhido = arquivos.length ? (EXT_VIDEO.test(arquivos[0].name) ? "video" : "fotos") : null;
  const tamanhoMb = arquivos.reduce((a, f) => a + f.size, 0) / 1024 / 1024;
  const m = job?.metricas;

  return (
    <section className="glass grid gap-4 rounded-panel p-3 md:p-4" aria-labelledby="envio-frota-t">
      <div className="grid gap-0.5">
        <h2 id="envio-frota-t" className="text-base font-semibold">Processar vídeo ou fotos de um ônibus</h2>
        <p className="text-sm text-ink-muted">
          Envie um vídeo curto (até 1 minuto é analisado) ou uma sequência de fotos da rua. A API detecta os danos no asfalto,
          borra rostos, pessoas e placas e coloca cada dano no mapa. O arquivo enviado é apagado assim que termina.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <label htmlFor="frota-arquivos" onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
          className={`grid min-h-32 cursor-pointer place-items-center gap-1 rounded-card border-2 border-dashed px-4 py-5 text-center text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-destaque ${arrastando ? "border-destaque bg-rail-active/45" : "border-line-strong hover:bg-rail-active/30"}`}>
          <input id="frota-arquivos" type="file" multiple accept="video/mp4,video/quicktime,video/webm,.mov,.m4v,.avi,.mkv,image/jpeg,image/png,image/webp"
            className="sr-only" onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
          {tipoEscolhido === "video" ? <Film aria-hidden="true" className="size-7" /> : tipoEscolhido === "fotos" ? <ImagePlus aria-hidden="true" className="size-7" /> : <Upload aria-hidden="true" className="size-7" />}
          {arquivos.length ? (
            <span>
              <strong className="font-semibold">{tipoEscolhido === "video" ? arquivos[0].name : `${arquivos.length} foto${arquivos.length > 1 ? "s" : ""}`}</strong>
              <span className="text-ink-muted"> · {num(tamanhoMb)} MB · clique para trocar</span>
            </span>
          ) : (
            <span><strong className="font-semibold">Escolha um vídeo ou várias fotos</strong><span className="block text-ink-muted">ou arraste para cá · MP4, MOV, WebM, JPG, PNG</span></span>
          )}
        </label>

        <div className="grid content-start gap-3">
          <div className="grid gap-1">
            <label htmlFor="frota-linha" className="text-sm font-semibold">Linha do ônibus</label>
            <input id="frota-linha" value={linha} maxLength={20} onChange={(e) => setLinha(e.target.value)}
              className="min-h-console w-full rounded-chip border-[1.5px] border-line-strong bg-surface-raised px-3 text-sm" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="frota-gpx" className="text-sm font-semibold">Trajeto GPS <span className="font-normal text-ink-muted">(opcional, .gpx)</span></label>
            <input id="frota-gpx" type="file" accept=".gpx,application/gpx+xml" onChange={(e) => setGpx(e.target.files?.[0] ?? null)}
              className="text-xs file:mr-2 file:min-h-console file:cursor-pointer file:rounded-chip file:border-0 file:bg-rail-active/60 file:px-3 file:text-sm file:font-semibold" />
            <p className="text-xs text-ink-muted">Sem GPS, usa um trajeto simulado na Av. Paulista.</p>
          </div>
          <Botao tamanho="console" icone={Upload} onClick={enviar} aria-busy={enviando || undefined}>
            {enviando ? "Enviando…" : "Processar"}
          </Botao>
        </div>
      </div>

      {erro && <Aviso tipo="warn" titulo="Falta um detalhe">{erro}</Aviso>}

      {job && (
        <div className="grid gap-3 border-t border-line pt-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <strong className="font-semibold">
              {job.tipo === "video" ? job.nome : `${job.arquivos} fotos`} · linha {job.linha_onibus}
            </strong>
            <span className="text-ink-muted">
              {job.status === "na_fila" && "Na fila…"}
              {job.status === "processando" && (job.quadros_processados ? `Analisando quadro ${job.quadros_processados} de ${job.quadros_total || "…"}` : "Preparando…")}
              {job.status === "concluido" && `Pronto em ${m?.tempo_total_s != null ? `${num(m.tempo_total_s)} s` : "—"}`}
              {job.status === "erro" && "Não deu certo"}
            </span>
          </div>

          {rodando(job) && (
            <div role="progressbar" aria-label="Progresso do processamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progresso * 100)}
              className="h-2.5 overflow-hidden rounded-full bg-rail-active/50">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(3, job.progresso * 100)}%` }} />
            </div>
          )}

          {job.status === "erro" && <Aviso tipo="danger" titulo="Não consegui processar">{job.mensagem ?? "Tente outro arquivo."}</Aviso>}

          {job.status === "concluido" && job.resultado && (
            <>
              {job.mensagem && <Aviso tipo="info" titulo="Aviso">{job.mensagem}</Aviso>}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <figure className="grid gap-1">
                  {video ? (
                    <video src={video} controls muted playsInline className="aspect-video w-full rounded-card bg-black object-contain" aria-label="Vídeo anotado com os danos detectados" />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center rounded-card bg-rail-active/40 text-sm text-ink-muted">Carregando o vídeo anotado…</div>
                  )}
                  <figcaption className="text-xs text-ink-muted">
                    Vídeo anotado, já borrado: caixa e número de cada dano, confiança e FPS na faixa de cima.
                    {job.video_tipo === "video/mp4" && " Se não tocar aqui, baixe e abra num player."}
                  </figcaption>
                </figure>
                <div className="grid content-start gap-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {([
                      ["Danos únicos", String(m?.danos_unicos ?? job.danos.length)],
                      ["Novas ocorrências", String(job.resultado.novas_ocorrencias)],
                      ["Juntadas a existentes", String(job.resultado.associadas_a_existentes)],
                      ["Possivelmente resolvidas", String(job.resultado.possivelmente_resolvidas)],
                      ["FPS do processamento", m?.fps_processamento != null ? num(m.fps_processamento) : "—"],
                      ["Detecção por quadro", m?.latencia_deteccao_ms ? `${num(m.latencia_deteccao_ms.media, 0)} ms` : "—"],
                      ["Quadros analisados", String(job.quadros_processados)],
                      ["Regiões borradas", String(m?.regioes_borradas ?? 0)],
                    ] as const).map(([r, v]) => (
                      <div key={r} className="glass-card grid gap-0.5 rounded-card px-3 py-2">
                        <dt className="text-xs text-ink-muted">{r}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-ink-muted">
                    {m?.tempo_real === "sim" ? "Mais rápido que o tempo real" : "Mais lento que o tempo real"} nesta máquina (CPU, YOLOv8n em ONNX, limiar {m?.limiar != null ? num(m.limiar, 2) : "—"}).
                    Os danos já estão no mapa abaixo e nas filas, com origem Ônibus.
                  </p>
                </div>
              </div>
              {job.danos.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Danos encontrados neste envio</caption>
                    <thead className="text-xs text-ink-muted">
                      <tr><th className="py-1 pr-3 font-semibold">Dano</th><th className="py-1 pr-3 font-semibold">Tipo</th><th className="py-1 pr-3 font-semibold">Confiança</th><th className="py-1 pr-3 font-semibold">Momento</th><th className="py-1 font-semibold">Quadros</th></tr>
                    </thead>
                    <tbody>
                      {job.danos.slice(0, 12).map((d) => (
                        <tr key={d.id} className="border-t border-line">
                          <td className="py-1.5 pr-3 tabular-nums">#{d.id}</td>
                          <td className="py-1.5 pr-3">{d.dano ?? d.classe}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{Math.round(d.conf_max * 100)}%</td>
                          <td className="py-1.5 pr-3 tabular-nums">{num(d.t_s)} s</td>
                          <td className="py-1.5 tabular-nums">{d.quadros}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {job.danos.length > 12 && <p className="mt-1 text-xs text-ink-muted">E mais {job.danos.length - 12}. Todos estão no mapa.</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

"use client";
// Tela inicial do cidadão (v1.1): abriu o app, entendeu. A bola de falar é o centro;
// foto e texto são as outras duas portas do mesmo Reportar. Sem cadastro.
import { Camera, LoaderCircle, LocateFixed, MapPin, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { guardarFotoPendente } from "@/features/reportar/rascunho";
import { BolaFalar } from "@/ui/BolaFalar";
import { Botao, BotaoLink } from "@/ui/Botao";
import { useEndereco, useLocalAparelho } from "@/ui/useLocal";
import { useDitado } from "@/ui/useVoz";
import { Painel } from "@/ui/Vidro";

const EXEMPLOS = [
  { rotulo: "Buraco na rua", texto: "Tem um buraco na rua" },
  { rotulo: "Poste apagado", texto: "O poste da rua está apagado" },
  { rotulo: "Lixo acumulado", texto: "Tem lixo acumulado na calçada" },
  { rotulo: "Fio solto", texto: "Tem um fio solto pendurado na rua" },
  { rotulo: "Bueiro entupido", texto: "A boca de lobo está entupida" },
  { rotulo: "Árvore caída", texto: "Uma árvore caiu na rua" },
];
const semAcao = () => {};

export function Inicio() {
  const router = useRouter();
  const { suportado } = useDitado(semAcao);
  const camera = useRef<HTMLInputElement>(null);

  const comFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    guardarFotoPendente(f);
    router.push("/reportar");
  };

  return (
    <Painel className="entrada grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
      <div className="grid justify-items-center gap-7 text-center">
        <OndeVoceEsta />

        <div className="grid gap-2">
          <h1 className="text-[32px] leading-[38px] font-medium tracking-[-0.03em]">Viu um problema na rua?</h1>
          <p className="mx-auto max-w-md text-[18px] leading-7 text-ink-muted">Conte o que viu e saiba quem resolve. Sem cadastro.</p>
        </div>

        <div className="py-2">
          {suportado === false
            ? <BolaFalar href="/reportar" rotulo="Reportar um problema" />
            : <BolaFalar rotulo="Toque e conte o que viu" aoTocar={() => router.push("/reportar?voz=1")} />}
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={comFoto} />
          <Botao variante="secundario" icone={Camera} bloco onClick={() => camera.current?.click()}>Tirar foto</Botao>
          <BotaoLink href="/reportar?escrever=1" variante="secundario" icone={PenLine} bloco>Escrever</BotaoLink>
        </div>

        <nav aria-label="Exemplos de problema" className="w-full max-w-xl">
          <ul className="flex flex-wrap justify-center gap-2">
            {EXEMPLOS.map((x) => (
              <li key={x.rotulo}>
                <Link href={`/reportar?texto=${encodeURIComponent(x.texto)}`}
                  className="inline-flex min-h-toque items-center rounded-pill bg-surface-raised px-4 text-base shadow-[inset_0_0_0_1px_var(--qr-line-strong)] hover:bg-rail-active/55">
                  {x.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ComoFunciona />
    </Painel>
  );
}

const PASSOS = [
  { titulo: "Você conta", texto: "Fale, escreva ou tire uma foto." },
  { titulo: "A gente diz quem resolve", texto: "Prefeitura, Sabesp, Enel ou outro órgão." },
  { titulo: "O pedido sai pronto", texto: "Com o local e um número para acompanhar." },
];

/** Três passos e um exemplo de resposta. No celular vai embaixo, mais enxuto (sem o exemplo). */
function ComoFunciona() {
  return (
    <section aria-labelledby="como-t" className="grid gap-5 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
      <h2 id="como-t" className="text-base font-semibold text-ink-muted">Como funciona</h2>
      <ol className="grid gap-4">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="grid grid-cols-[auto_1fr] gap-x-3">
            <span aria-hidden="true" className="row-span-2 grid size-8 place-items-center rounded-full bg-rail-active text-base font-semibold text-on-rail-active">{i + 1}</span>
            <strong className="text-[17px] font-semibold">{p.titulo}</strong>
            <span className="text-base text-ink-muted">{p.texto}</span>
          </li>
        ))}
      </ol>
      <figure className="glass-card hidden gap-1 rounded-card p-4 lg:grid">
        <figcaption className="text-base text-ink-muted">Exemplo: “Tem um buraco na rua”</figcaption>
        <p className="text-base text-ink-muted">Quem resolve</p>
        <p className="text-xl leading-[26px] font-semibold tracking-[-0.015em]">Prefeitura (subprefeitura)</p>
        <p className="text-base">Pelo <strong>SP156</strong></p>
      </figure>
    </section>
  );
}

/** "Você está em Rua Augusta, 900": só pergunta a localização se a pessoa tocar (sem pop-up ao abrir o app). */
function OndeVoceEsta() {
  const { fase, local, pegar } = useLocalAparelho({ auto: true });
  const { endereco, buscando } = useEndereco(local);
  const chip = "inline-flex min-h-toque items-center gap-2 rounded-pill bg-surface-raised/80 px-4 text-base";
  if (fase === "ok" && local) {
    return (
      <p role="status" className={chip}>
        <MapPin aria-hidden="true" className="size-5 shrink-0 text-destaque" />
        <span><span className="text-ink-muted">Você está em </span>
          <strong className="font-semibold">{endereco ? endereco.texto_curto : buscando ? "…" : "São Paulo"}</strong></span>
      </p>
    );
  }
  if (fase === "negado" || fase === "indisponivel") return null; // o Reportar explica e oferece a busca
  return (
    <button type="button" onClick={pegar} className={`${chip} cursor-pointer text-ink-muted hover:text-ink`}>
      {fase === "buscando" ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : <LocateFixed aria-hidden="true" className="size-5" />}
      {fase === "buscando" ? "Procurando onde você está…" : "Mostrar onde estou"}
    </button>
  );
}

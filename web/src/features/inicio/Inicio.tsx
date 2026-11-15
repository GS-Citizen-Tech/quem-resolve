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
    <Painel className="entrada grid justify-items-center gap-7 text-center">
      <OndeVoceEsta />

      <div className="grid gap-2">
        <h1 className="text-[32px] leading-[38px] font-medium tracking-[-0.03em]">Viu um problema na rua?</h1>
        <p className="mx-auto max-w-md text-[18px] leading-7 text-ink-muted">
          Conte para a gente. A gente diz quem resolve e já prepara o pedido. Sem cadastro.
        </p>
      </div>

      <div className="py-4">
        {suportado === false
          ? <BolaFalar href="/reportar" rotulo="Reportar um problema" dica="Foto, texto e local numa tela só" />
          : <BolaFalar rotulo="Toque e conte o que viu" dica="Você fala, a gente escreve" aoTocar={() => router.push("/reportar?voz=1")} />}
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={comFoto} />
        <Botao variante="secundario" icone={Camera} bloco onClick={() => camera.current?.click()}>Tirar foto</Botao>
        <BotaoLink href="/reportar?escrever=1" variante="secundario" icone={PenLine} bloco>Escrever</BotaoLink>
      </div>

      <nav aria-label="Exemplos de problema" className="grid w-full max-w-xl gap-2">
        <p className="text-base text-ink-muted">Ou comece por um exemplo:</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {EXEMPLOS.map((x) => (
            <li key={x.rotulo}>
              <Link href={`/reportar?texto=${encodeURIComponent(x.texto)}`}
                className="inline-flex min-h-toque items-center rounded-pill bg-surface-raised px-4 text-base font-medium shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/55">
                {x.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Painel>
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

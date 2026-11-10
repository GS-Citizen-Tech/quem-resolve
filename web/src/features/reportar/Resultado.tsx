"use client";
// Etapa 4 · Resultado: o que a IA entendeu, quem resolve e o "Não é isso" (human-in-the-loop).
import { ArrowRight, Camera, PenLine, Sparkles, Text, User, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoEmergencia } from "@/ui/Botao";
import { FotoComDeteccoes } from "@/ui/FotoComDeteccoes";
import { Selo, SeloConfianca } from "@/ui/Selo";
import { SeletorCategoria } from "@/ui/SeletorCategoria";
import { useFala } from "@/ui/useVoz";
import type { BaseQuemResolve } from "@/providers/base";
import type { Categoria } from "@/providers/tipos";
import { QuemResolve } from "./QuemResolve";
import type { Rascunho } from "./rascunho";

const ORIGEM = {
  visao: { icone: Camera, texto: "Identificado pela foto" },
  regras: { icone: Text, texto: "Identificado pelo texto" },
  llm: { icone: Sparkles, texto: "Identificado pela IA" },
} as const;

export function Resultado({ r, base, previa, aoEscolher, aoContinuar, aoDetalhar }: {
  r: Rascunho; base: BaseQuemResolve; previa: string | null;
  aoEscolher: (c: Categoria) => void; aoContinuar: () => void; aoDetalhar: () => void;
}) {
  const a = r.analise;
  const categoria = base.categorias.find((c) => c.id === r.categoriaId) ?? null;
  const responsavel = categoria ? base.responsaveis.find((x) => x.id === categoria.responsavel_id) ?? (a?.responsavel ?? null) : null;
  const daIA = r.escolha === "ia" && a?.categoria && categoria?.id === a.categoria.id;
  const duvida = !!a && a.guardrail.pode_continuar && (a.precisa_confirmar || !a.categoria);
  const [lista, setLista] = useState(r.manual !== null || duvida);
  const [erro, setErro] = useState<string | null>(null);
  const fala = useFala();

  // Sem categoria, as "alternativas" da API são só o começo da lista: não chamamos de "mais prováveis".
  const provaveis = (a?.categoria ? [a.categoria, ...a.alternativas] : [])
    .filter((c): c is Categoria => !!c)
    .map((c) => base.categorias.find((x) => x.id === c.id) ?? c)
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

  const textoFalado = categoria && responsavel
    ? `Isso parece ser ${categoria.nome}. Quem resolve: ${responsavel.nome}, pelo canal ${responsavel.canal}. ${daIA && a ? a.proximo_passo : ""}`
    : "";

  const continuar = () => {
    if (!categoria) { setErro("Escolha na lista o problema que mais se parece."); setLista(true); return; }
    aoContinuar();
  };

  return (
    <div className="grid gap-5">
      {r.manual === "falha" && (
        <Aviso tipo="warn" titulo="Não consegui analisar agora">
          Escolha o problema na lista e eu digo quem resolve. Se preferir, ligue 156 (SP156), da Prefeitura.
        </Aviso>
      )}
      {r.manual === "nao_emergencia" && (
        <Aviso tipo="info" titulo="Tudo bem, vamos seguir">Escolha na lista o problema que mais se parece.</Aviso>
      )}
      {a?.guardrail.nivel === 3 && a.guardrail.canal_principal && (
        <div className="grid gap-3 rounded-card bg-warn-soft p-4 hc:border-2 hc:border-line-strong">
          <Aviso tipo="warn" titulo="Atenção: pode haver risco">
            Fique longe do local. Se houver perigo agora, ligue {a.guardrail.canal_principal.numero} ({a.guardrail.canal_principal.nome}). Seu reporte continua abaixo.
          </Aviso>
          <BotaoEmergencia numero={a.guardrail.canal_principal.numero} nome={a.guardrail.canal_principal.nome} />
        </div>
      )}
      {r.avisoFoto && <Aviso tipo="info" titulo="Não consegui olhar a foto">{r.avisoFoto}</Aviso>}
      {previa && r.manual !== "falha" && <FotoComDeteccoes src={previa} deteccoes={r.deteccoes} />}

      {categoria && (
        <div className="grid gap-3 entrada">
          <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">
            {daIA ? "Isso parece ser " : "Você escolheu "}<strong className="font-bold">{categoria.nome}</strong>
          </h1>
          <div className="flex flex-wrap gap-2">
            {daIA && a ? <>
              <SeloConfianca valor={a.confianca} />
              {a.classificado_por !== "nenhum" && <Selo tom="neutro" icone={ORIGEM[a.classificado_por].icone} texto={ORIGEM[a.classificado_por].texto} />}
            </> : <Selo tom="info" icone={User} texto="Escolhido por você" />}
          </div>
          {daIA && a && <>
            <p className="text-[18px] leading-7">{a.proximo_passo}</p>
            <details className="group rounded-control px-1">
              <summary className="flex min-h-toque cursor-pointer items-center font-semibold underline underline-offset-4">Por que a IA acha isso?</summary>
              <p className="pb-2 text-ink-muted">
                {a.explicacao} {a.classificado_por === "visao" ? "A foto teve o peso maior." : a.classificado_por === "regras" ? "Palavras da sua descrição bateram com esta categoria." : a.classificado_por === "llm" ? "Um modelo de linguagem leu a sua descrição." : ""}
                {r.deteccoes.length > 0 && a.classificado_por !== "visao" ? " A foto também foi analisada." : ""}
              </p>
            </details>
          </>}
        </div>
      )}
      {!categoria && r.manual === null && <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Não consegui identificar o problema</h1>}

      {responsavel && <QuemResolve responsavel={responsavel} indice={1} />}

      {categoria && fala.suportado && (
        <Botao variante="link" icone={fala.falando ? VolumeX : Volume2} onClick={() => (fala.falando ? fala.parar() : fala.falar(textoFalado))}>
          {fala.falando ? "Parar leitura" : "Ouvir resposta"}
        </Botao>
      )}

      {duvida && r.escolha === "ia" && (
        <Aviso tipo="info" titulo={a?.categoria ? "Não tenho certeza" : "Preciso da sua ajuda"} acao={
          <Botao variante="link" icone={PenLine} onClick={aoDetalhar} className="justify-self-start">Adicionar mais detalhes</Botao>
        }>{a?.categoria ? "Confira se é isso. Se não for, escolha abaixo ou conte mais detalhes." : "Escolha na lista o que mais se parece, ou conte mais detalhes."}</Aviso>
      )}

      {lista && (
        <SeletorCategoria categorias={base.categorias} responsaveis={base.responsaveis}
          provaveis={provaveis.filter((c) => c.id !== categoria?.id || !daIA)}
          selecionada={r.escolha === "cidadao" ? r.categoriaId : null}
          titulo={categoria && daIA ? "Qual destes é o problema?" : "Escolha o problema"}
          aoEscolher={(c) => { setErro(null); aoEscolher(c); }} />
      )}
      {erro && <p role="alert" className="font-semibold text-danger">{erro}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Botao icone={ArrowRight} bloco onClick={continuar}>{categoria ? "Está certo, continuar" : "Continuar"}</Botao>
        {!lista && <Botao variante="secundario" bloco onClick={() => setLista(true)}>Não é isso</Botao>}
      </div>
    </div>
  );
}

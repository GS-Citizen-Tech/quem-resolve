"use client";
// Vitrine dos componentes de ui/ em todos os estados (útil para conferir o design e para o vídeo).
import { Camera, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/ui/Aviso";
import { Botao, BotaoEmergencia } from "@/ui/Botao";
import { CampoTexto } from "@/ui/CampoTexto";
import { Carregando, Vazio } from "@/ui/Estados";
import { Marca } from "@/ui/Marca";
import { BarraTopo } from "@/ui/Navegacao";
import { SeloConfianca, SeloOrigem, SeloPrioridade } from "@/ui/Selo";
import { SeletorTema } from "@/ui/SeletorTema";
import { CartaoVidro, Painel } from "@/ui/Vidro";

export function Vitrine() {
  const [texto, setTexto] = useState("");
  const [tentou, setTentou] = useState(false);
  const erro = tentou && texto.trim().length < 5 ? "Conte um pouco mais: onde fica e o tamanho." : undefined;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <BarraTopo direita={<SeletorTema />} />
      <Painel as="main" className="grid gap-6">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.03em]">Componentes</h1>

        <CartaoVidro rotulo="Marca" titulo="Assinatura" indice={0}>
          <div className="mt-3 flex items-center gap-6"><Marca /><Marca tamanho={20} comNome={false} /></div>
        </CartaoVidro>

        <CartaoVidro rotulo="Botões" titulo="Ações" indice={1}>
          <div className="mt-3 flex flex-wrap gap-3">
            <Botao icone={Send}>Confirmar e gerar solicitação</Botao>
            <Botao variante="secundario">Não é isso</Botao>
            <Botao variante="link">Recomeçar</Botao>
            <Botao tamanho="console">Reclassificar</Botao>
            <Botao tamanho="console" variante="secundario">Mudar status</Botao>
          </div>
          <div className="mt-4 max-w-md"><BotaoEmergencia numero="193" nome="Bombeiros" /></div>
        </CartaoVidro>

        <CartaoVidro rotulo="Selos" titulo="Cor + ícone + palavra" indice={2}>
          <div className="mt-3 flex flex-wrap gap-2">
            <SeloConfianca valor={0.92} /><SeloConfianca valor={0.64} /><SeloConfianca valor={0.31} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <SeloConfianca valor={0.92} compacto /><SeloPrioridade valor={4} /><SeloPrioridade valor={3} /><SeloPrioridade valor={2} />
            <SeloOrigem origem="cidadao" /><SeloOrigem origem="frota" /><SeloOrigem origem="ambos" />
          </div>
        </CartaoVidro>

        <CartaoVidro rotulo="Campo" titulo="Descrição do problema" indice={3}>
          <div className="mt-3 grid gap-3">
            <CampoTexto id="desc" multilinha rotulo="O que está acontecendo?" obrigatorio
              dica="Ex.: buraco grande na frente do número 120" value={texto} erro={erro}
              onChange={(e) => setTexto(e.target.value)} />
            <div><Botao onClick={() => setTentou(true)}>Descobrir quem resolve</Botao></div>
          </div>
        </CartaoVidro>

        <div className="grid gap-3 md:grid-cols-2">
          <Aviso tipo="ok" titulo="Solicitação gerada">Protocolo QR-261108-A1B2C. Vamos encaminhar ao órgão.</Aviso>
          <Aviso tipo="info" titulo="Envio simulado">No protótipo, o e-mail vai para uma caixa de teste.</Aviso>
          <Aviso tipo="warn" titulo="Pode haver risco">Se o fio estiver soltando faísca, ligue antes de continuar.</Aviso>
          <Aviso tipo="danger" titulo="Sem conexão">Não conseguimos falar com o servidor. Escolha a categoria na lista.</Aviso>
        </div>

        <CartaoVidro rotulo="Estados" titulo="Latência e vazio" indice={4}>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Carregando texto="Descobrindo quem resolve…" etapas={["Olhando a foto", "Entendendo o texto", "Descobrindo quem resolve"]} atual={1} />
            <Vazio titulo="Nenhum reporte ainda" texto="Os problemas que você reportar aparecem aqui." />
          </div>
        </CartaoVidro>

        <CartaoVidro rotulo="Quem resolve" icone={MapPin} titulo="Prefeitura (subprefeitura)" indice={5}>
          <p className="mt-1">Canal: SP156 · 156</p>
          <p className="mt-3 flex gap-2 text-ink-muted"><Camera aria-hidden="true" className="size-5" /> Identificado pela foto</p>
        </CartaoVidro>
      </Painel>
    </div>
  );
}

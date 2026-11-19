// Privacidade (LGPD): o que o app guarda, por quanto tempo e o que nunca guarda. Texto simples, sem jargão.
import { Painel } from "@/ui/Vidro";

const ITENS: { titulo: string; texto: string }[] = [
  { titulo: "Sem cadastro", texto: "Você não informa nome, CPF, e-mail nem telefone. Seus reportes e conversas ficam salvos só neste aparelho." },
  { titulo: "O que vai para o órgão", texto: "O tipo do problema, a descrição, a foto e o local. Isso serve só para resolver o problema na rua." },
  { titulo: "Fotos", texto: "Antes de guardar, a foto é reduzida, perde os dados escondidos do arquivo (como o modelo do celular) e tem rostos, pessoas e placas de carro borrados." },
  { titulo: "Por quanto tempo", texto: "A foto e a descrição são apagadas 90 dias depois que o problema é resolvido. Ficam só o tipo, o órgão e as datas, para as estatísticas da cidade." },
  { titulo: "Emergência e violência", texto: "Quando o app mostra a tela de emergência, nada do que você escreveu é guardado. A saída rápida apaga o rascunho e a conversa deste aparelho." },
  { titulo: "Voz", texto: "O áudio vira texto e é descartado na hora. Só o texto é usado para responder." },
  { titulo: "Inteligência artificial", texto: "A IA sugere quem resolve, mas pode errar. Você sempre vê a sugestão e pode corrigir antes de enviar." },
  { titulo: "Câmeras nos ônibus", texto: "As imagens servem só para achar danos na rua. Rostos e placas são borrados, o vídeo original é apagado e ninguém é identificado." },
];

export function Privacidade() {
  return (
    <Painel className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.025em]">Privacidade</h1>
        <p className="text-ink-muted">Seguimos a LGPD: o app usa o mínimo de dados para o problema chegar a quem resolve.</p>
      </div>
      <dl className="grid gap-4">
        {ITENS.map((i) => (
          <div key={i.titulo} className="grid gap-1">
            <dt className="text-lg font-semibold">{i.titulo}</dt>
            <dd>{i.texto}</dd>
          </div>
        ))}
      </dl>
      <p className="text-base text-ink-muted">Projeto acadêmico da FIAP (2026). Este protótipo não substitui o SP156 nem os telefones de emergência.</p>
    </Painel>
  );
}

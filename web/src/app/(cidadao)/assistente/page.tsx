import { Assistente } from "@/features/assistente/Assistente";

export const metadata = { title: "Tirar dúvida" };

// Chat com o assistente RAG e conversa por voz (F2, docs/PLANO-F2.md).
export default function Page() {
  return <Assistente />;
}

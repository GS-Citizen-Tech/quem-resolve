import { Suspense } from "react";
import { LayoutConsole } from "@/features/gestao/LayoutConsole";
import { Carregando } from "@/ui/Estados";

export const metadata = { title: { default: "Console da gestão", template: "%s · Console · Quem Resolve?" } };

// Console da gestão (F3). Os filtros vivem na URL (useSearchParams), por isso o Suspense.
export default function Layout({ children }: LayoutProps<"/gestao">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8"><Carregando texto="Abrindo o console…" /></div>}>
      <LayoutConsole>{children}</LayoutConsole>
    </Suspense>
  );
}

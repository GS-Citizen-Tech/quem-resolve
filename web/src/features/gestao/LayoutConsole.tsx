"use client";
// Moldura do console: topo com a pessoa logada e "Sair", trilho (desktop) e dock (celular e base do painel).
// Sem login, qualquer tela da gestão manda para Entrar e depois volta para onde a pessoa ia.
import { BarChart3, Bus, ListOrdered, LogOut, MapPinned, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BarraTopo, Dock, Trilho, type ItemNav } from "@/ui/Navegacao";
import { SeletorTema } from "@/ui/SeletorTema";
import { Carregando } from "@/ui/Estados";
import { useAppState } from "@/state/AppState";
import { useBase, useFiltros } from "./hooks";

const ITENS: ItemNav[] = [
  { href: "/gestao", rotulo: "Visão geral", icone: BarChart3, exato: true },
  { href: "/gestao/mapa", rotulo: "Mapa", icone: MapPinned },
  { href: "/gestao/filas", rotulo: "Filas", icone: ListOrdered },
  { href: "/gestao/frota", rotulo: "Frota", icone: Bus },
  { href: "/gestao/qualidade", rotulo: "Qualidade", icone: ShieldCheck },
];

const ENTRAR = "/gestao/entrar";

export function LayoutConsole({ children }: { children: ReactNode }) {
  const { estado } = useAppState();
  const caminho = usePathname();
  const router = useRouter();
  const naEntrada = caminho === ENTRAR;
  const precisaEntrar = estado.carregado && !estado.sessao && !naEntrada;

  useEffect(() => {
    if (precisaEntrar) router.replace(`${ENTRAR}?volta=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [precisaEntrar, router]);

  if (naEntrada) {
    return (
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-4 p-4">
        <BarraTopo inicio="/" direita={<SeletorTema />} />
        <main id="conteudo" className="flex-1">{children}</main>
      </div>
    );
  }
  if (!estado.carregado || !estado.sessao) {
    return <div className="mx-auto max-w-6xl p-8"><Carregando texto="Conferindo seu login…" /></div>;
  }
  return <Moldura>{children}</Moldura>;
}

function Moldura({ children }: { children: ReactNode }) {
  const { estado, despachar } = useAppState();
  const { sufixo } = useFiltros();
  const { nomeOrgao } = useBase();
  const router = useRouter();
  const sessao = estado.sessao!;

  const sair = () => {
    despachar({ tipo: "logout" });
    router.replace(ENTRAR);
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-[1400px] flex-col gap-4 px-3 pt-3 pb-28 text-sm md:px-4 md:pt-4 md:pb-6">
      <BarraTopo inicio="/gestao" direita={<>
        <p className="hidden text-right leading-tight sm:block">
          <span className="block font-semibold">{sessao.nome}</span>
          <span className="block text-xs text-ink-muted">{nomeOrgao(sessao.orgao_id)}</span>
        </p>
        <SeletorTema />
        <button type="button" onClick={sair}
          className="inline-flex min-h-console cursor-pointer items-center gap-1.5 rounded-chip px-3 font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--qr-line-strong)] hover:bg-rail-active/55">
          <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
          Sair
        </button>
      </>} />
      <p className="text-xs text-ink-muted sm:hidden">
        Você entrou como <strong className="text-ink">{sessao.nome}</strong> · {nomeOrgao(sessao.orgao_id)}
      </p>
      <div className="flex flex-1 items-start gap-4">
        <div className="sticky top-4"><Trilho itens={ITENS} rotulo="Seções do console" sufixo={sufixo} /></div>
        <main id="conteudo" className="grid min-w-0 flex-1 gap-4">{children}</main>
      </div>
      <Dock itens={ITENS} rotulo="Seções do console" fixo sufixo={sufixo} />
    </div>
  );
}

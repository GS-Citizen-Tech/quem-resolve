"use client";
// Moldura do console. Computador: barra lateral (marca, telas, pessoa logada, Aparência, Sair). Celular: topo + barra de baixo.
// Sem login, qualquer tela da gestão manda para Entrar e depois volta para onde a pessoa ia.
import { BarChart3, Bus, ListOrdered, LogOut, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BarraTopo, Dock, Trilho, type ItemNav } from "@/ui/Navegacao";
import { Marca } from "@/ui/Marca";
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
      <div className="console">
        <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-4 p-4">
          <BarraTopo inicio="/" direita={<SeletorTema />} />
          <main id="conteudo" className="flex-1">{children}</main>
        </div>
      </div>
    );
  }
  if (!estado.carregado || !estado.sessao) {
    return <div className="console"><div className="mx-auto max-w-6xl p-8"><Carregando texto="Conferindo seu login…" /></div></div>;
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
  const botaoSair = (
    <button type="button" onClick={sair}
      className="flex min-h-console w-full cursor-pointer items-center gap-2.5 rounded-chip px-2.5 text-sm font-medium text-ink-muted hover:bg-rail-active/55 hover:text-ink">
      <LogOut aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      Sair
    </button>
  );

  return (
    <div className="console text-sm">
      <div className="mx-auto flex max-w-[1480px] gap-6 px-3 lg:px-5">
        {/* Computador: barra lateral com a marca, as telas e a pessoa logada. */}
        <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-6 py-5 lg:flex">
          <Link href="/gestao" className="rounded-chip px-1.5"><Marca /></Link>
          <Trilho itens={ITENS} rotulo="Seções do console" sufixo={sufixo} />
          <div className="mt-auto grid gap-0.5 border-t border-[var(--qr-linha)] pt-3">
            <p className="px-2.5 pb-2 leading-tight">
              <span className="block text-[15px] font-semibold">{sessao.nome}</span>
              <span className="block text-xs text-ink-muted">{nomeOrgao(sessao.orgao_id)}</span>
            </p>
            <SeletorTema abre="cima" comRotulo />
            {botaoSair}
          </div>
        </aside>
        <div className="flex min-h-svh min-w-0 flex-1 flex-col gap-4 pt-3 pb-28 lg:py-5">
          {/* Celular e tablet: barra do topo; as telas ficam na barra de baixo. */}
          <BarraTopo className="lg:hidden" inicio="/gestao" direita={<>
            <p className="hidden text-right leading-tight sm:block">
              <span className="block font-semibold">{sessao.nome}</span>
              <span className="block text-xs text-ink-muted">{nomeOrgao(sessao.orgao_id)}</span>
            </p>
            <SeletorTema />
            <button type="button" onClick={sair} aria-label="Sair" title="Sair"
              className="grid size-12 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-rail-active/45 hover:text-ink">
              <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </button>
          </>} />
          <main id="conteudo" className="grid min-w-0 gap-4">{children}</main>
        </div>
      </div>
      <Dock itens={ITENS} rotulo="Seções do console" some="lg" sufixo={sufixo} />
    </div>
  );
}

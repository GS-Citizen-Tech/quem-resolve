import { LayoutCidadao } from "@/features/cidadao/LayoutCidadao";

export default function Layout({ children }: LayoutProps<"/">) {
  return <LayoutCidadao>{children}</LayoutCidadao>;
}

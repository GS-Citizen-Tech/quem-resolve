import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { AppStateProvider } from "@/state/AppState";
import "./globals.css";

// Fonte do design system: feita para baixa visão (I, l, 1 e O, 0 diferentes).
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fonte-atkinson" });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--fonte-atkinson-mono" });

export const metadata: Metadata = {
  title: { default: "Quem Resolve?", template: "%s · Quem Resolve?" },
  description: "Descubra em menos de 1 minuto quem resolve o problema da sua rua em São Paulo.",
  icons: { icon: "/marca/qr-marca.svg", apple: "/marca/qr-icone-app.svg" },
};

export const viewport: Viewport = { themeColor: "#294b39", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body className="cena cena-foto">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-chip focus:bg-surface-raised focus:p-3">
          Pular para o conteúdo
        </a>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}

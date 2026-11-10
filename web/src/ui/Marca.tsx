// Assinatura: símbolo (pin com check) + nome com o "?". O símbolo troca pelo tema (<img> não herda cor).
/* eslint-disable @next/next/no-img-element */
export function Marca({ tamanho = 32, comNome = true }: { tamanho?: number; comNome?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.035em] whitespace-nowrap">
      <img src="/marca/qr-marca.svg" alt="" width={tamanho} height={tamanho} className="block dark:hidden hc:hidden" />
      <img src="/marca/qr-marca-escuro.svg" alt="" width={tamanho} height={tamanho} className="hidden dark:block hc:hidden" />
      <img src="/marca/qr-marca-preto.svg" alt="" width={tamanho} height={tamanho} className="hidden hc:block" />
      {comNome ? <span className="text-[17px]">Quem Resolve?</span> : <span className="sr-only">Quem Resolve?</span>}
    </span>
  );
}

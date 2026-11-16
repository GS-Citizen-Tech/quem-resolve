// Lista suspensa única do app: mesma altura, borda e seta em todas as telas (o <select> do navegador, só vestido).
import type { SelectHTMLAttributes } from "react";

export function Selecao({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`qr-selecao min-h-console cursor-pointer rounded-chip border border-line-strong bg-surface-raised pl-2.5 text-sm text-ink hover:border-ink ${className}`}>
      {children}
    </select>
  );
}

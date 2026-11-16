"use client";
// Uma barra só, dividida em partes (ex.: quem viu o problema). Cada parte tem nome e número escritos embaixo,
// então a cor nunca fica sozinha. Com `aoClicar`, cada parte vira um botão de filtro.
export interface Parte { chave: string; rotulo: string; valor: number }

const TONS = ["bg-chart-1", "bg-chart-1/60", "bg-chart-1/30"];

export function BarraPartes({ titulo, partes, destaque, aoClicar, unidade = "ocorrências" }: {
  titulo: string; partes: Parte[]; destaque?: string; aoClicar?: (chave: string) => void; unidade?: string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  if (!total) return null;
  const pct = (v: number) => Math.round((v / total) * 100);
  return (
    <section className="grid gap-3" aria-label={titulo}>
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-pill">
        {partes.map((p, i) => p.valor > 0 && (
          <span key={p.chave} style={{ flexGrow: p.valor }}
            className={`basis-0 ${TONS[i % TONS.length]} ${destaque && destaque !== p.chave ? "opacity-30" : ""} hc:border hc:border-line-strong`} />
        ))}
      </div>
      <ul className="grid gap-1">
        {partes.map((p, i) => {
          const linha = (
            <>
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${TONS[i % TONS.length]} hc:border hc:border-line-strong`} />
              <span className="flex-1 text-left">{p.rotulo}</span>
              <span className="font-semibold tabular-nums">{p.valor}</span>
              <span className="w-10 text-right text-ink-muted tabular-nums">{pct(p.valor)}%</span>
            </>
          );
          return (
            <li key={p.chave}>
              {aoClicar ? (
                <button type="button" onClick={() => aoClicar(p.chave)} aria-pressed={destaque === p.chave}
                  aria-label={`${p.rotulo}: ${p.valor} ${unidade}, ${pct(p.valor)}%. Filtrar`}
                  className="flex min-h-console w-full cursor-pointer items-center gap-2.5 rounded-chip px-2 text-sm hover:bg-[color-mix(in_srgb,var(--qr-ink)_5%,transparent)] aria-pressed:bg-[color-mix(in_srgb,var(--qr-ink)_8%,transparent)]">
                  {linha}
                </button>
              ) : <p className="flex min-h-console items-center gap-2.5 px-2 text-sm">{linha}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

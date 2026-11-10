// Campo com rótulo sempre visível, dica opcional e erro com ícone. Sempre sólido (surface-raised).
import { CircleAlert } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";

interface Comum { id: string; rotulo: string; dica?: string; erro?: string; obrigatorio?: boolean; lateral?: ReactNode }
type PropsInput = Comum & { multilinha?: false; ref?: Ref<HTMLInputElement> } & InputHTMLAttributes<HTMLInputElement>;
type PropsArea = Comum & { multilinha: true; ref?: Ref<HTMLTextAreaElement> } & TextareaHTMLAttributes<HTMLTextAreaElement>;

const campo =
  "w-full rounded-control border-[1.5px] border-line-strong bg-surface-raised px-4 text-[17px] text-ink placeholder:text-ink-muted aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";

export function CampoTexto(props: PropsInput | PropsArea) {
  const { id, rotulo, dica, erro, obrigatorio, lateral } = props;
  const descr = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  const aria = { id, "aria-invalid": erro ? true : undefined, "aria-describedby": descr, "aria-required": obrigatorio || undefined };
  let controle: ReactNode;
  if (props.multilinha) {
    const { multilinha: _m, rotulo: _r, dica: _d, erro: _e, obrigatorio: _o, lateral: _l, className = "", ...resto } = props;
    controle = <textarea {...resto} {...aria} className={`${campo} min-h-28 py-3 ${className}`} />;
  } else {
    const { multilinha: _m, rotulo: _r, dica: _d, erro: _e, obrigatorio: _o, lateral: _l, className = "", ...resto } = props;
    controle = <input {...resto} {...aria} className={`${campo} min-h-toque ${className}`} />;
  }
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[17px] font-semibold">
        {rotulo}{obrigatorio && <span className="text-ink-muted font-normal"> (obrigatório)</span>}
      </label>
      {dica && <p id={`${id}-dica`} className="text-base text-ink-muted">{dica}</p>}
      <div className="flex items-start gap-2">{controle}{lateral}</div>
      {erro && (
        <p id={`${id}-erro`} className="flex items-center gap-1.5 text-base font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="size-[18px]" />{erro}
        </p>
      )}
    </div>
  );
}

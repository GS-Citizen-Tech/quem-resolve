"use client";
// Foto opcional: câmera ou galeria, com prévia, "trocar" e "remover".
// A foto é reduzida no aparelho (lado maior 1600 px) antes de enviar: upload mais
// rápido e os metadados EXIF (como o GPS da câmera) não saem do celular (LGPD).
import { Camera, CircleAlert, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Botao } from "./Botao";

const LADO_MAX = 1600;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export class ErroFoto extends Error {}

/** Reduz e recodifica a foto em JPEG (sem EXIF). Lança ErroFoto com mensagem pronta. */
export async function prepararFoto(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) throw new ErroFoto("Esse arquivo não é uma foto. Use JPG, PNG ou WEBP.");
  if (arquivo.size > 40 * 1024 * 1024) throw new ErroFoto("Essa foto é grande demais. Tente outra ou tire uma nova.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new ErroFoto("Não consegui abrir essa foto. Tente uma em JPG ou PNG.");
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) {
    if (TIPOS.includes(arquivo.type) && arquivo.size <= 8 * 1024 * 1024) return arquivo;
    throw new ErroFoto("Não consegui preparar essa foto. Tente outra.");
  }
  if (blob.size > 8 * 1024 * 1024) throw new ErroFoto("A foto passa de 8 MB mesmo reduzida. Tente outra.");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

export function FotoEntrada({ previa, ocupado, erro, aoEscolher, aoRemover }: {
  previa: string | null; ocupado?: boolean; erro?: string | null;
  aoEscolher: (arquivo: File) => void; aoRemover: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) aoEscolher(f);
  };
  return (
    <div className="grid gap-2" aria-describedby={erro ? "foto-erro" : undefined}>
      <p className="text-[17px] font-semibold">Foto <span className="font-normal text-ink-muted">(opcional, ajuda a identificar)</span></p>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolher} />
      <input ref={galeria} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolher} />
      {previa ? (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previa} alt="Prévia da foto escolhida" className="aspect-[4/3] w-full rounded-card object-cover sm:w-40" />
          <div className="grid gap-2 sm:justify-items-start">
            <Botao variante="secundario" icone={RefreshCw} onClick={() => galeria.current?.click()}>Trocar foto</Botao>
            <Botao variante="link" icone={Trash2} onClick={aoRemover}>Remover foto</Botao>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Botao variante="secundario" icone={Camera} bloco onClick={() => camera.current?.click()}>
            {ocupado ? "Preparando foto…" : "Tirar foto"}
          </Botao>
          <Botao variante="secundario" icone={ImagePlus} bloco onClick={() => galeria.current?.click()}>Escolher da galeria</Botao>
        </div>
      )}
      {erro && (
        <p id="foto-erro" role="alert" className="flex items-center gap-1.5 text-base font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="size-[18px]" />{erro}
        </p>
      )}
    </div>
  );
}

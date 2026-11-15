"use client";
// Localização do aparelho + endereço por extenso (contrato O, v1.1).
// Usado na tela inicial ("Você está em …") e no Reportar (cartão Local e mapa em tela cheia).
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/providers/api";
import type { Endereco, Localizacao } from "@/providers/tipos";

export type FaseLocal = "parado" | "buscando" | "ok" | "negado" | "indisponivel";

/** "Rua Augusta, 900 · Consolação": o texto que vai no cartão, na confirmação e no fim da descrição. */
export const textoEndereco = (e: Endereco | null) => (e ? [e.texto_curto, e.bairro].filter(Boolean).join(" · ") : null);
/** Quando o OpenStreetMap não responde: as coordenadas, para a pessoa saber que o ponto foi marcado. */
export const textoCoordenadas = (l: Localizacao) => `${l.lat.toFixed(5).replace(".", ",")}, ${l.lon.toFixed(5).replace(".", ",")}`;

/** Pede a posição ao navegador. Resolve com a posição ou com o motivo da falha. */
export function pedirPosicao(): Promise<Localizacao | "negado" | "indisponivel"> {
  return new Promise((ok) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { ok("indisponivel"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => ok(e.code === e.PERMISSION_DENIED ? "negado" : "indisponivel"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** A permissão de localização já foi dada? (sem perguntar nada à pessoa). */
export async function permissaoLocal(): Promise<PermissionState | "desconhecida"> {
  try {
    const r = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return r.state;
  } catch { return "desconhecida"; }
}

/** Endereço de um ponto, com estado de carregamento. `null` no ponto = nada a buscar. */
export function useEndereco(ponto: Localizacao | null, esperaMs = 0) {
  const [estado, setEstado] = useState<{ chave: string; endereco: Endereco | null; falhou: boolean } | null>(null);
  const chave = ponto ? `${ponto.lat.toFixed(5)},${ponto.lon.toFixed(5)}` : "";
  const atual = useRef(chave);
  useEffect(() => {
    atual.current = chave;
    if (!ponto) return;
    const t = setTimeout(() => {
      api.endereco(ponto.lat, ponto.lon)
        .then((e) => { if (atual.current === chave) setEstado({ chave, endereco: e, falhou: false }); })
        .catch(() => { if (atual.current === chave) setEstado({ chave, endereco: null, falhou: true }); });
    }, esperaMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, esperaMs]);
  const pronto = estado?.chave === chave;
  return { endereco: pronto ? estado.endereco : null, falhou: pronto && estado.falhou, buscando: !!ponto && !pronto };
}

/** Localização do aparelho sob demanda (`pegar`) ou automática quando a permissão já existe (`auto`). */
export function useLocalAparelho({ auto = false }: { auto?: boolean } = {}) {
  const [fase, setFase] = useState<FaseLocal>("parado");
  const [local, setLocal] = useState<Localizacao | null>(null);
  const pegar = useCallback(async () => {
    setFase("buscando");
    const r = await pedirPosicao();
    if (typeof r === "string") { setFase(r); return null; }
    setLocal(r);
    setFase("ok");
    return r;
  }, []);
  useEffect(() => {
    if (!auto) return;
    let vivo = true;
    permissaoLocal().then((p) => { if (vivo && p === "granted") pegar(); });
    return () => { vivo = false; };
  }, [auto, pegar]);
  return { fase, local, pegar };
}

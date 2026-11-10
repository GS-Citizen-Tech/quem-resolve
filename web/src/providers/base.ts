// Base "quem resolve o quê" com reserva: se a API não responder, usa a cópia embutida.
import { api } from "./api";
import { CATEGORIAS_RESERVA, RESPONSAVEIS_RESERVA } from "./reserva";
import type { Categoria, Responsavel } from "./tipos";

export interface BaseQuemResolve { categorias: Categoria[]; responsaveis: Responsavel[]; reserva: boolean }

export async function carregarBase(): Promise<BaseQuemResolve> {
  try {
    const [categorias, responsaveis] = await Promise.all([api.categorias(), api.responsaveis()]);
    return { categorias, responsaveis, reserva: false };
  } catch {
    return { categorias: CATEGORIAS_RESERVA, responsaveis: RESPONSAVEIS_RESERVA, reserva: true };
  }
}

export const BASE_RESERVA: BaseQuemResolve = { categorias: CATEGORIAS_RESERVA, responsaveis: RESPONSAVEIS_RESERVA, reserva: true };

/** Centro de São Paulo (Praça da Sé): usado quando a pessoa não libera a localização. */
export const CENTRO_SP = { lat: -23.5505, lon: -46.6333 };

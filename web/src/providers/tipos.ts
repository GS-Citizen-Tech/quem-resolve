// Espelho dos contratos da API (docs/CONTRATOS.md v0.8 e api/app/schemas). Mudou lá, muda aqui.

export type Emergencia = "sim" | "nao" | "depende";
export type Origem = "cidadao" | "frota" | "ambos";
export type Status = "pendente_envio" | "enviada" | "possivelmente_resolvida" | "resolvida";

export interface Localizacao { lat: number; lon: number }
export interface Responsavel { id: string; nome: string; canal: string; contato: string; url: string | null }
export interface Categoria { id: string; nome: string; responsavel_id: string; emergencia: Emergencia; palavras: string[]; classes_visao: string[] }
export interface Fonte { titulo: string; url: string | null; trecho?: string | null }

// B · Guardrail
export interface CanalEmergencia { nome: string; numero: string; quando: string }
export interface GuardrailResultado {
  nivel: 0 | 1 | 2 | 3;
  tipo: string | null;
  camada: "regras" | "llm" | "visao" | null;
  justificativa: string | null;
  canal_principal: CanalEmergencia | null;
  outros_canais: CanalEmergencia[];
  pode_continuar: boolean;
  saida_rapida: boolean;
}

// C · Visão
/** origem "yolo" = detector treinado (pavimento, sempre com caixa); "multimodal" = reserva para as outras categorias (caixa opcional). */
export interface Deteccao {
  classe: string; categoria_id: string | null; confianca: number;
  bbox?: [number, number, number, number] | null;
  origem?: "yolo" | "multimodal"; descricao?: string | null;
}
export interface VisaoResultado { deteccoes: Deteccao[]; modelo: string; latencia_ms: number }

// D · Análise do reporte
export interface ReporteEntrada { descricao: string; localizacao?: Localizacao | null; deteccoes_visao?: Deteccao[] }
export interface AnaliseReporte {
  guardrail: GuardrailResultado;
  categoria: Categoria | null;
  responsavel: Responsavel | null;
  confianca: number;
  precisa_confirmar: boolean;
  explicacao: string;
  proximo_passo: string;
  classificado_por: "regras" | "llm" | "visao" | "nenhum";
  alternativas: Categoria[];
  fontes: Fonte[];
}

// E · Ocorrências
export interface OcorrenciaCriar {
  descricao: string; localizacao: Localizacao; categoria_sugerida: string | null;
  confianca: number; categoria_final: string; foto_url?: string | null;
}
export interface Ocorrencia {
  id: string; protocolo: string; criada_em: string; descricao: string; lat: number; lon: number;
  categoria_sugerida: string | null; confianca: number; categoria_final: string; responsavel_id: string;
  corrigida_pelo_cidadao: boolean; corrigida_pelo_gestor: boolean; status: Status; prioridade: number;
  origem: Origem; grupo_duplicata_id: string | null; foto_url: string | null;
}
export interface AtualizarStatus { status?: Status; categoria_final?: string; observacao?: string }
export interface FiltrosOcorrencia { categoria?: string; responsavel?: string; origem?: Origem; status?: Status }

// F · Métricas
export interface Contagem { chave: string; total: number }
export interface Metricas {
  total: number; por_categoria: Contagem[]; por_responsavel: Contagem[]; por_origem: Contagem[];
  pct_fora_prefeitura: number; taxa_correcao_cidadao: number;
}

// G · Assistente RAG / H · Voz
export interface Mensagem { papel: "cidadao" | "assistente"; texto: string }
export interface RespostaAssistente {
  id: string; resposta: string; fontes: Fonte[]; sem_fonte: boolean; fora_do_tema: boolean; modelo: string;
  guardrail?: GuardrailResultado | null; // v0.7: nível > 0 (emergência ou risco)
}
export interface Latencias { stt_ms: number; llm_ms: number; tts_ms: number; total_ate_fala_ms: number }
export interface RespostaVoz { transcricao: string; resposta: RespostaAssistente; texto_falado: string; audio_base64: string | null; latencias: Latencias }

// I · Frota
export interface PassagemResumo {
  linha_onibus: string; inicio: string; fim: string; trajeto: [number, number][]; deteccoes: number; fps: number | null;
  possivelmente_resolvidas?: number; // v0.8
}

// J · IoT OuviAí
export interface EventoSom {
  id: string; classe: "sirene" | "buzina" | "ambiente"; confianca: number; dispositivo: string;
  recebido_em: string; alerta: boolean; mensagem: string;
}

// K · Saúde · L · Feedback · M · Login
export interface Saude { status: string; modulos: Record<string, string> }
export interface FeedbackEntrada { alvo: "reporte" | "assistente"; id: string; util: boolean; comentario?: string }
export interface Sessao { token: string; nome: string; orgao_id: string; expira_em: string }

// N · Qualidade da IA (v0.8, só gestor)
export interface QualidadeVisao { chamadas: number; latencia_media_ms: number | null; latencia_p95_ms: number | null; por_origem: Record<string, number> }
export interface QualidadeClassificacao {
  total: number; confianca_media: number | null; baixa_confianca: number; corrigidas_pelo_cidadao: number; corrigidas_pelo_gestor: number;
}
export interface QualidadeFeedback { util: number; total: number }
export interface QualidadeGuardrail { nivel: number; total: number; nao_e_emergencia: number }
export interface Qualidade {
  modulos: Record<string, string>; visao: QualidadeVisao; classificacao: QualidadeClassificacao;
  feedback: Record<string, QualidadeFeedback>; guardrail: QualidadeGuardrail[];
}

/** Faixas do selo de confiança (design system): alta ≥ 0,8 · média 0,5–0,79 · baixa < 0,5. */
export type NivelConfianca = "alta" | "media" | "baixa";
export const nivelConfianca = (c: number): NivelConfianca => (c >= 0.8 ? "alta" : c >= 0.5 ? "media" : "baixa");

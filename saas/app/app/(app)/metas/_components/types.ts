export interface Indicador {
  id: number; cicloId: number; codigo: string; nome: string; tipo: string; abrangencia: string;
  unidade: string; metaMinima?: number | null; metaAlvo?: number | null; metaMaxima?: number | null;
  baseline?: number | null; metrica?: string | null;
  piso?: number | null; teto?: number | null; gatilho?: number | null; bonusMetaZero?: number | null;
  periodicidade: string; criterioApuracao: string;
  origemDado?: string | null; analistaResp?: string | null; numeradorId?: number | null;
  divisorId?: number | null; statusJanela: string; status: string; descricao?: string | null;
}

export interface FaixaIndicador { id?: number; de: number; ate: number; nota: number; }

export interface IndicadorNoGrupo { id: number; indicadorId: number; peso: number; indicador: Indicador; }

export interface Agrupamento {
  id: number; cicloId: number; nome: string; tipo: string;
  descricao?: string | null; indicadores: IndicadorNoGrupo[];
}

export interface Colaborador {
  id: number; nome: string; matricula: string; grade?: string | null;
  gestorId?: number | null; centroCusto?: string | null;
  area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null;
}

export interface Atribuicao {
  id: number; colaboradorId: number; agrupamentoId: number;
  pesoNaCesta: number; cascata: string;
  colaborador: Colaborador; agrupamento: Agrupamento;
}

export const TIPOS = ["MAIOR_MELHOR", "MENOR_MELHOR", "PROJETO_MARCO"];
export const ABRANGENCIA = ["CORPORATIVO", "AREA", "INDIVIDUAL"];
export const PERIODICIDADE = ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
export const CRITERIO = ["SOMA", "MEDIA", "ULTIMA_POSICAO"];
export const UNIDADES = ["%", "R$", "Unidades", "Dias", "Horas", "Pontos", "Índice", "NPS", "Score", "Toneladas", "Km", "Litros", "Kg"];
export const STATUS_JANELA_COLOR: Record<string, string> = {
  ABERTA: "bg-green-100 text-green-700",
  FECHADA: "bg-gray-100 text-gray-500",
  PRORROGADA: "bg-yellow-100 text-yellow-700",
};

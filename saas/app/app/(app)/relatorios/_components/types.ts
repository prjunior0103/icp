// ─── Shared types for relatorios ─────────────────────────

export interface Indicador {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  unidade: string;
  metaMinima?: number | null;
  metaAlvo?: number | null;
  metaMaxima?: number | null;
  periodicidade: string;
  criterioApuracao: string;
  numeradorId?: number | null;
  divisorId?: number | null;
  faixas?: { de: number; ate: number; nota: number }[];
  analistaResp?: string | null;
  responsavelEnvio?: { id: number; nome: string } | null;
}

export interface Realizacao {
  id: number;
  indicadorId: number;
  periodo: string;
  valorRealizado: number;
}

export interface MetaPeriodo {
  id: number;
  indicadorId: number;
  periodo: string;
  valorOrcado: number;
}

export interface IndicadorNoGrupo {
  indicadorId: number;
  peso: number;
  indicador: Indicador;
}

export interface Agrupamento {
  id: number;
  nome: string;
  tipo: string;
  indicadores: IndicadorNoGrupo[];
}

export interface Colaborador {
  id: number;
  nome: string;
  matricula: string;
  cargo: string;
  salarioBase: number;
  target: number;
  gestorId?: number | null;
  centroCusto?: string | null;
  area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null;
}

export interface Atribuicao {
  colaboradorId: number;
  agrupamentoId: number;
  pesoNaCesta: number;
  colaborador: Colaborador;
  agrupamento: Agrupamento;
}

export interface ColaboradorBasico {
  id: number;
  nome: string;
  matricula: string;
  cargo: string;
  area?: { nivel1: string } | null;
}

export interface AgrupamentoBasico {
  id: number;
  nome: string;
  tipo: string;
}

export interface MovRel {
  id: number;
  matricula: string;
  tipo: string;
  dataEfetiva: string;
  dadosAntigos: string | null;
  dadosNovos: string | null;
  requerNovoPainel: boolean;
  painelAnteriorNome: string | null;
  painelNovoNome: string | null;
  statusTratamento: string;
  nomeColaborador: string | null;
}

export type AbaId =
  | "colaborador"
  | "indicador"
  | "contratacao"
  | "responsavel"
  | "gestor"
  | "calibracao"
  | "pendencias"
  | "movimentacoes"
  | "sem-painel"
  | "nao-apurados"
  | "ppt"
  | "carta";

export const MOV_TIPO_LABEL: Record<string, string> = {
  ADMISSAO: "Admissão",
  DESLIGAMENTO: "Desligamento",
  POSSIVEL_DESLIGAMENTO: "Possível Desligamento",
  AFASTAMENTO: "Afastamento",
  RETORNO: "Retorno",
  MUDANCA_FUNCAO: "Mud. Função",
  MUDANCA_AREA: "Mud. Área",
  MUDANCA_GESTOR: "Mud. Gestor",
  MUDANCA_AREA_GESTOR: "Mud. Área+Gestor",
  MOVIMENTACAO: "Movimentação",
};

export const MOV_TIPO_COR: Record<string, string> = {
  ADMISSAO: "bg-green-100 text-green-700",
  DESLIGAMENTO: "bg-red-100 text-red-700",
  POSSIVEL_DESLIGAMENTO: "bg-red-50 text-red-600",
  AFASTAMENTO: "bg-orange-100 text-orange-700",
  RETORNO: "bg-blue-100 text-blue-700",
  MUDANCA_FUNCAO: "bg-purple-100 text-purple-700",
  MUDANCA_AREA: "bg-yellow-100 text-yellow-700",
  MUDANCA_GESTOR: "bg-indigo-100 text-indigo-700",
  MUDANCA_AREA_GESTOR: "bg-pink-100 text-pink-700",
  MOVIMENTACAO: "bg-gray-100 text-gray-700",
};

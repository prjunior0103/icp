export interface Area {
  id: number;
  cicloId: number;
  centroCusto: string;
  codEmpresa: string;
  nivel1: string;
  nivel2?: string | null;
  nivel3?: string | null;
  nivel4?: string | null;
  nivel5?: string | null;
}

export interface Colaborador {
  id: number;
  cicloId: number;
  areaId?: number | null;
  area?: Area | null;
  nome: string;
  email?: string | null;
  matricula: string;
  cargo: string;
  grade?: string | null;
  salarioBase: number;
  target: number;
  centroCusto?: string | null;
  codEmpresa?: string | null;
  admissao?: string | null;
  gestorId?: number | null;
  matriculaGestor?: string | null;
  nomeGestor?: string | null;
  status: string;
}

export const STATUS_COLORS: Record<string, string> = {
  ATIVO:    "bg-green-100 text-green-700",
  INATIVO:  "bg-gray-100 text-gray-500",
  AFASTADO: "bg-yellow-100 text-yellow-700",
};

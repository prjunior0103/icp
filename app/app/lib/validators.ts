/**
 * Pure validation functions for bulk-import rows.
 * Each returns an error message string or null (valid).
 */

import { normalizarLinhaColaborador, parseSalario } from "./calc";

// ── Colaborador ───────────────────────────────────────────────────────────────

export interface ColaboradorRow {
  matricula: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  salarioBase: string;
  dataAdmissao: string;
  empresaCodigo: string;
  cargoCodigo: string;
  centroCustoCodigo: string;
  gestorMatricula: string;
}

export function validarLinhaColaborador(raw: Record<string, unknown>): {
  erro: string | null;
  dados: ColaboradorRow;
} {
  const r = normalizarLinhaColaborador(raw);

  if (!r.matricula)
    return { erro: "Campo 'matricula' obrigatório", dados: r as unknown as ColaboradorRow };
  if (!r.nomeCompleto)
    return { erro: "Campo 'nomeCompleto' obrigatório", dados: r as unknown as ColaboradorRow };

  const salario = parseSalario(r.salarioBase);
  if (r.salarioBase && isNaN(salario))
    return { erro: `salarioBase inválido: '${r.salarioBase}'`, dados: r as unknown as ColaboradorRow };
  if (salario < 0)
    return { erro: "salarioBase não pode ser negativo", dados: r as unknown as ColaboradorRow };

  if (r.dataAdmissao) {
    const d = new Date(r.dataAdmissao);
    if (isNaN(d.getTime()))
      return { erro: `dataAdmissao inválida: '${r.dataAdmissao}'`, dados: r as unknown as ColaboradorRow };
  }

  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    return { erro: `email inválido: '${r.email}'`, dados: r as unknown as ColaboradorRow };

  return { erro: null, dados: r as unknown as ColaboradorRow };
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export interface MetaRow {
  indicadorCodigo: string;
  centroCustoCodigo: string;
  pesoNaCesta: string;
  metaMinima: string;
  metaAlvo: string;
  metaMaxima: string;
}

export function validarLinhaMeta(raw: Record<string, string>): string | null {
  if (!raw.indicadorCodigo)
    return "Campo 'indicadorCodigo' obrigatório";

  const alvo = Number(raw.metaAlvo);
  if (raw.metaAlvo === "" || raw.metaAlvo === undefined)
    return "Campo 'metaAlvo' obrigatório";
  if (isNaN(alvo))
    return `metaAlvo inválido: '${raw.metaAlvo}'`;
  if (alvo <= 0)
    return "metaAlvo deve ser maior que zero";

  const peso = Number(raw.pesoNaCesta ?? 100);
  if (isNaN(peso) || peso < 0 || peso > 100)
    return `pesoNaCesta inválido: '${raw.pesoNaCesta}' (deve ser 0–100)`;

  if (raw.metaMinima) {
    const min = Number(raw.metaMinima);
    if (isNaN(min)) return `metaMinima inválida: '${raw.metaMinima}'`;
    if (min >= alvo) return "metaMinima deve ser menor que metaAlvo";
  }

  if (raw.metaMaxima) {
    const max = Number(raw.metaMaxima);
    if (isNaN(max)) return `metaMaxima inválida: '${raw.metaMaxima}'`;
    if (max <= alvo) return "metaMaxima deve ser maior que metaAlvo";
  }

  return null;
}

// ── BP Realizações ────────────────────────────────────────────────────────────

export interface RealizacaoRow {
  matricula: string;
  metaCodigo: string;
  valorRealizado: number;
  observacao?: string;
}

export function validarLinhaRealizacao(raw: {
  matricula?: string;
  metaCodigo?: string;
  codigo_indicador?: string;
  valorRealizado?: unknown;
  valor_realizado?: unknown;
}): { erro: string | null; dados: RealizacaoRow } {
  const matricula = (raw.matricula ?? "").toString().trim();
  const metaCodigo = (raw.metaCodigo ?? raw.codigo_indicador ?? "").toString().trim();
  const valorRaw = raw.valorRealizado ?? raw.valor_realizado;
  const valorRealizado = Number(valorRaw);

  if (!matricula)
    return { erro: "Campo 'matricula' obrigatório", dados: { matricula, metaCodigo, valorRealizado } };
  if (!metaCodigo)
    return { erro: "Campo 'metaCodigo' / 'codigo_indicador' obrigatório", dados: { matricula, metaCodigo, valorRealizado } };
  if (valorRaw === undefined || valorRaw === null || valorRaw === "")
    return { erro: "Campo 'valorRealizado' obrigatório", dados: { matricula, metaCodigo, valorRealizado } };
  if (isNaN(valorRealizado))
    return { erro: `valorRealizado inválido: '${valorRaw}'`, dados: { matricula, metaCodigo, valorRealizado } };
  if (valorRealizado < 0)
    return { erro: "valorRealizado não pode ser negativo", dados: { matricula, metaCodigo, valorRealizado } };

  return { erro: null, dados: { matricula, metaCodigo, valorRealizado } };
}

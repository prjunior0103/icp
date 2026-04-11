export const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** "2025-04" → "Abr/2025" */
export function labelPeriodo(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MESES[parseInt(m[2]) - 1]}/${m[1]}`;
  return p;
}

/** Formata data ISO para pt-BR: "02/04/2025" */
export function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formata data+hora ISO para pt-BR: "02/04/2025 14:30" */
export function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PREFIXO_UNIDADES = new Set(["R$"]);

/** Formata valor numérico com unidade: "R$ 1200" ou "85%" */
export function fmtValor(valor: number | null | undefined, unidade: string): string {
  if (valor == null) return "—";
  return PREFIXO_UNIDADES.has(unidade) ? `${unidade} ${valor}` : `${valor}${unidade}`;
}

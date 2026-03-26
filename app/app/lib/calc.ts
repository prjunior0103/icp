/**
 * Pure business-logic functions for the ICP calculation engine.
 * Extracted here so they can be tested independently of framework / DB.
 */

// ── Nota calculation ─────────────────────────────────────────────────────────

export function calcularNota(
  tipo: string,
  polaridade: string,
  valorRealizado: number,
  metaAlvo: number,
  metaMinima: number | null,
  metaMaxima: number | null
): number {
  if (metaAlvo === 0) return 0;
  let nota = 0;

  if (tipo === "PROJETO_MARCO") {
    // Pass/fail: 100 if realizado >= 1 (true), else 0
    nota = valorRealizado >= 1 ? 100 : 0;
  } else if (polaridade === "MENOR_MELHOR") {
    // Ex: custo, prazo, defeitos — menor realizado = melhor nota
    nota = valorRealizado === 0 ? 120 : (metaAlvo / valorRealizado) * 100;
    // Pior que o teto (max): zero score
    if (metaMaxima && valorRealizado > metaMaxima) nota = 0;
  } else {
    // MAIOR_MELHOR (default): maior realizado = melhor nota
    nota = (valorRealizado / metaAlvo) * 100;
    // Below minimum: zero score
    if (metaMinima && valorRealizado < metaMinima) nota = 0;
  }

  // Cap upside: use metaMaxima ratio or default 120
  if (tipo !== "PROJETO_MARCO") {
    if (metaMaxima && metaAlvo > 0 && polaridade !== "MENOR_MELHOR") {
      nota = Math.min(nota, (metaMaxima / metaAlvo) * 100);
    } else {
      nota = Math.min(nota, 120);
    }
  }

  return Math.max(0, nota);
}

// ── Premio projection ─────────────────────────────────────────────────────────

export function calcularPremio(
  salarioBase: number,
  targetBonusPerc: number,   // e.g. 15 for 15%
  nota: number,              // 0–120
  pesoNaCesta: number        // 0–100
): number {
  return (
    salarioBase * 12 * (targetBonusPerc / 100) * (nota / 100) * (pesoNaCesta / 100)
  );
}

// ── Import row normalisation ──────────────────────────────────────────────────

export function normalizarLinhaColaborador(
  raw: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.replace(/^\uFEFF/, "").trim()] = String(v ?? "").trim();
  }
  return out;
}

export function parseSalario(raw: string): number {
  return Number(raw.replace(",", ".")) || 0;
}

// Motor de cálculo ICP — funções puras

export interface FaixaIndicador { de: number; ate: number; nota: number; }

export interface IndicadorCalc {
  tipo: string;           // MAIOR_MELHOR | MENOR_MELHOR | PROJETO_MARCO
  metaMinima?: number | null;
  metaAlvo?: number | null;
  metaMaxima?: number | null;
  piso?: number | null;           // atingimento mínimo decimal (default 0.0)
  teto?: number | null;           // atingimento máximo decimal (default 1.5)
  gatilho?: number | null;        // atingimento mínimo para pagamento; abaixo → retorna 0
  bonusMetaZero?: number | null;  // atingimento quando meta=0 e realizado na direção certa (default 1.0)
  faixas?: FaixaIndicador[];
}

/**
 * Calcula atingimento em fração decimal usando "Desvio Relativo com Módulo".
 *
 * Fórmula universal: atingimento = 1 + P × (realizado − meta) / |meta|
 *   P = +1 para MAIOR_MELHOR | P = −1 para MENOR_MELHOR
 *
 * Suporta meta e realizado negativos (ex: LAIR).
 * Não realiza conversão de unidade — meta e realizado devem estar na mesma unidade.
 */
export function calcAtingimento(
  meta: number,
  realizado: number,
  tipo: string,
  opts: { piso?: number; teto?: number; gatilho?: number | null; bonusMetaZero?: number } = {}
): number {
  const piso = opts.piso ?? 0.0;
  const teto = opts.teto ?? 1.5;
  const gatilho = opts.gatilho ?? null;
  const bonusMetaZero = opts.bonusMetaZero ?? 1.0;

  if (tipo === "PROJETO_MARCO") return realizado >= 1 ? 1.0 : 0.0;

  const P = tipo === "MAIOR_MELHOR" ? 1 : -1;

  if (meta === 0) {
    if (tipo === "MAIOR_MELHOR") return realizado >= 0 ? bonusMetaZero : 0.0;
    return realizado <= 0 ? bonusMetaZero : 0.0;
  }

  let atingimento = 1 + P * (realizado - meta) / Math.abs(meta);

  if (gatilho != null && atingimento < gatilho) return 0.0;
  atingimento = Math.max(piso, atingimento);
  atingimento = Math.min(teto, atingimento);

  return atingimento;
}

/**
 * Calcula nota (0 – teto×100) dado o valor realizado e a config do indicador.
 * Faixas têm precedência sobre a fórmula universal.
 */
export function calcNota(ind: IndicadorCalc, valorRealizado: number): number {
  const { tipo, metaAlvo, faixas, piso, teto, gatilho, bonusMetaZero } = ind;

  if (faixas && faixas.length > 0) {
    const faixa = faixas.find(f => valorRealizado >= f.de && valorRealizado <= f.ate);
    return faixa ? faixa.nota : 0;
  }

  if (tipo === "PROJETO_MARCO") return valorRealizado >= 1 ? 100 : 0;

  if (metaAlvo == null) return 0;

  return calcAtingimento(metaAlvo, valorRealizado, tipo, {
    piso: piso ?? undefined,
    teto: teto ?? undefined,
    gatilho: gatilho ?? null,
    bonusMetaZero: bonusMetaZero ?? undefined,
  }) * 100;
}

/** MID = nota × peso do indicador no agrupamento / 100 */
export function calcMID(nota: number, pesoIndicador: number): number {
  return (nota * pesoIndicador) / 100;
}

/** Resultado do colaborador = soma de todos os MIDs */
export function calcResultadoColaborador(mids: number[]): number {
  return mids.reduce((sum, m) => sum + m, 0);
}

/** Prêmio projetado = salárioBase × target × (resultado / 100) */
export function calcPremio(salarioBase: number, target: number, resultado: number): number {
  return salarioBase * (target / 100) * (resultado / 100);
}

/** Gera os períodos de um ciclo de acordo com a periodicidade do indicador */
export function gerarPeriodos(
  anoFiscal: number,
  mesInicio: number,
  mesFim: number,
  periodicidade: string
): string[] {
  const periodos: string[] = [];
  if (periodicidade === "ANUAL") return [`${anoFiscal}`];
  if (periodicidade === "SEMESTRAL") {
    const s1 = mesInicio <= 6 ? 1 : 2;
    const s2 = mesFim >= 7 ? 2 : 1;
    for (let s = s1; s <= s2; s++) periodos.push(`${anoFiscal}-S${s}`);
    return periodos;
  }
  if (periodicidade === "TRIMESTRAL") {
    for (let m = mesInicio; m <= mesFim; m += 3) {
      const t = Math.ceil(m / 3);
      periodos.push(`${anoFiscal}-T${t}`);
    }
    return periodos;
  }
  for (let m = mesInicio; m <= mesFim; m++) {
    periodos.push(`${anoFiscal}-${String(m).padStart(2, "0")}`);
  }
  return periodos;
}

/** Agrega múltiplos valores pelo critério do indicador */
export function agregarRealizacoes(valores: number[], criterio: string): number | null {
  if (valores.length === 0) return null;
  if (criterio === "SOMA") return valores.reduce((a, b) => a + b, 0);
  if (criterio === "MEDIA") return valores.reduce((a, b) => a + b, 0) / valores.length;
  return valores[valores.length - 1];
}

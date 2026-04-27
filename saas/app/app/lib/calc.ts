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

export type Polaridade = "maior_melhor" | "menor_melhor";

export interface AuditoriaAtingimento {
  meta: number;
  realizado: number;
  polaridade: Polaridade;
  piso: number;
  teto: number;
  gatilho: number | null;
  bonusMetaZero: number;
  atingimentoFinal: number;
  timestamp: string;
}

/**
 * Calcula atingimento em fração decimal usando "Desvio Relativo com Módulo".
 *
 * Fórmula universal: atingimento = 1 + P × (realizado − meta) / |meta|
 *   P = +1 para maior_melhor | P = −1 para menor_melhor
 *
 * Suporta meta e realizado negativos (ex: LAIR).
 * Não realiza conversão de unidade — meta e realizado devem estar na mesma unidade.
 * Para PROJETO_MARCO use calcNota diretamente (não é uma polaridade).
 */
export function calcAtingimento(
  meta: number,
  realizado: number,
  polaridade: Polaridade,
  opts: {
    piso?: number;
    teto?: number;
    gatilho?: number | null;
    bonusMetaZero?: number;
    onAudit?: (a: AuditoriaAtingimento) => void;
  } = {}
): number {
  const piso = opts.piso ?? 0.0;
  const teto = opts.teto ?? 1.5;
  const gatilho = opts.gatilho ?? null;
  const bonusMetaZero = opts.bonusMetaZero ?? 1.0;

  const P = polaridade === "maior_melhor" ? 1 : -1;

  let atingimento: number;

  if (meta === 0) {
    if (polaridade === "maior_melhor") {
      atingimento = realizado >= 0 ? bonusMetaZero : 0.0;
    } else {
      atingimento = realizado <= 0 ? bonusMetaZero : 0.0;
    }
  } else {
    atingimento = 1 + P * (realizado - meta) / Math.abs(meta);
    if (gatilho != null && atingimento < gatilho) atingimento = 0.0;
    else {
      atingimento = Math.max(piso, atingimento);
      atingimento = Math.min(teto, atingimento);
    }
  }

  if (opts.onAudit) {
    opts.onAudit({
      meta, realizado, polaridade, piso, teto, gatilho, bonusMetaZero,
      atingimentoFinal: atingimento,
      timestamp: new Date().toISOString(),
    });
  }

  return atingimento;
}

/**
 * Versão auditada de calcAtingimento — retorna resultado + dados de auditoria.
 * Usar em rotas de API onde é possível persistir o log no banco.
 */
export function calcAtingimentoAuditado(
  meta: number,
  realizado: number,
  polaridade: Polaridade,
  opts: { piso?: number; teto?: number; gatilho?: number | null; bonusMetaZero?: number } = {}
): { atingimento: number; auditoria: AuditoriaAtingimento } {
  let auditoria!: AuditoriaAtingimento;
  const atingimento = calcAtingimento(meta, realizado, polaridade, {
    ...opts,
    onAudit: (a) => { auditoria = a; },
  });
  return { atingimento, auditoria };
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

  const polaridade: Polaridade = tipo === "MAIOR_MELHOR" ? "maior_melhor" : "menor_melhor";

  return calcAtingimento(metaAlvo, valorRealizado, polaridade, {
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

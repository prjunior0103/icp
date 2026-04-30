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
  piso: number | null;
  teto: number | null;
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
    piso?: number | null;
    teto?: number | null;
    gatilho?: number | null;
    bonusMetaZero?: number;
    onAudit?: (a: AuditoriaAtingimento) => void;
  } = {}
): number {
  // undefined → default histórico; null → sem piso/teto
  const piso = opts.piso === undefined ? 0.0 : opts.piso;
  const teto = opts.teto === undefined ? 1.5 : opts.teto;
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
      if (piso !== null) atingimento = Math.max(piso, atingimento);
      if (teto !== null) atingimento = Math.min(teto, atingimento);
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
  opts: { piso?: number | null; teto?: number | null; gatilho?: number | null; bonusMetaZero?: number } = {}
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
    piso: piso !== undefined ? piso : undefined,
    teto: teto !== undefined ? teto : undefined,
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

/**
 * Calcula a fração de ávos (0–1) com base na data real do evento e nas datas do ciclo.
 *
 * Regra dos 15 dias:
 * - ADMISSAO: dia ≤ 15 → mês da admissão conta; dia > 15 → conta a partir do mês seguinte
 * - DESLIGAMENTO: dia ≥ 15 → mês do desligamento conta; dia < 15 → conta até o mês anterior
 * - Demais tipos → avos = 1 (ciclo cheio, sem proporcionalidade)
 */
export function calcAvosMeses(params: {
  tipo: "ADMISSAO" | "DESLIGAMENTO" | string;
  dataMovimentacao: Date;
  anoFiscal: number;
  mesInicio: number;
  mesFim: number;
}): number {
  const { tipo, dataMovimentacao, anoFiscal, mesInicio, mesFim } = params;
  const totalMeses = mesFim - mesInicio + 1;
  if (totalMeses <= 0) return 1;

  const dia = dataMovimentacao.getDate();
  const mesEvento = dataMovimentacao.getMonth() + 1; // 1-based

  if (tipo === "ADMISSAO") {
    // Mês efetivo de início: dia ≤ 15 → mesEvento, dia > 15 → mesEvento + 1
    const mesEfetivoInicio = dia <= 15 ? mesEvento : mesEvento + 1;
    const mesesAtivos = Math.max(0, mesFim - Math.max(mesEfetivoInicio, mesInicio) + 1);
    return Math.min(1, mesesAtivos / totalMeses);
  }

  if (tipo === "DESLIGAMENTO") {
    // Mês efetivo de fim: dia ≥ 15 → mesEvento, dia < 15 → mesEvento - 1
    const mesEfetivoFim = dia >= 15 ? mesEvento : mesEvento - 1;
    const mesesAtivos = Math.max(0, Math.min(mesEfetivoFim, mesFim) - mesInicio + 1);
    return Math.min(1, mesesAtivos / totalMeses);
  }

  return 1;
}

